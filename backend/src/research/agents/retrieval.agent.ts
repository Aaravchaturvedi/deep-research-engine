// backend/src/research/agents/retrieval.agent.ts
import { randomUUID } from "crypto";
import { ResearchState } from "../types";
import {
  QDRANT_URL,
  COLLECTION_NAME,
  ensureCollection,
  getExtractor,
  upsertPoints,
} from "../../utils/vectorStore";

export const retrievalAgent = async (state: typeof ResearchState.State,config: any) => {
  config.configurable.socket.emit("research:progress", { step: "Embedding and retrieving context (Local Model)..." });
  console.log("➡️ [Retrieval Agent] Embedding and retrieving context (Local Model)...");
  const extractor = await getExtractor();

  // 1. Ensure the Qdrant collection exists (Size 384 for the local model)
  await ensureCollection();

  // 2. Embed scraped chunks sequentially
  console.log(`Embedding ${state.scrapedDocs.length} chunks locally...`);
  const points: { id: string; vector: number[]; payload: Record<string, any> }[] = [];
  
  for (let i = 0; i < state.scrapedDocs.length; i++) {
    const doc = state.scrapedDocs[i];
    try {
      // Local model embedding
      const output = await extractor(doc.text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data as Float32Array) as number[];

      points.push({
        id: randomUUID(),
        vector: vector,
        payload: {
          text: doc.text,
          url: doc.url,
          queryRef: state.query,
          loopCount: state.loopCount,
        },
      });
    } catch (err) {
      console.error(`⚠️ Failed to embed chunk ${i} from ${doc.url}`);
    }
  }

  // 3. Upsert points to Qdrant
  await upsertPoints(points);

  // 4. Embed the user's query locally
  const queryOutput = await extractor(state.query, { pooling: "mean", normalize: true });
  const queryVector = Array.from(queryOutput.data);

  // 5. Query Qdrant for the top 5 relevant chunks
  const searchResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vector: queryVector,
      limit: 5,
      with_payload: true,
    }),
  });

  const searchData = await searchResponse.json() as any;
  const searchResults = searchData.result || [];
  const retrievedContext = searchResults.map((hit: any) => `[Source: ${hit.payload?.url || "Unknown"}]\n${hit.payload?.text || ""}`).join("\n\n---\n\n");

  console.log(`✅ [Retrieval Agent] Retrieved ${searchResults.length} relevant chunks from Qdrant.`);
  return { retrievedContext };
};