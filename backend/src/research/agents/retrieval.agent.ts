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
  // Graceful degradation: if the local embedding model (onnxruntime native
  // binding) fails to load, fall back to raw scraped context instead of
  // failing the entire multi-minute research job.
  const fallbackContext = state.scrapedDocs
    .slice(0, 12)
    .map((doc: any) => `[Source: ${doc.url || "Unknown"}]\n${doc.text || ""}`)
    .join("\n\n---\n\n");

  let extractor;
  try {
    extractor = await getExtractor();
  } catch (err) {
    console.error("⚠️ [Retrieval Agent] Local embedding model failed to load, using raw scraped context:", (err as Error).message);
    return { retrievedContext: fallbackContext };
  }

  // 1. Ensure the Qdrant collection exists (Size 384 for the local model)
  try {
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

    if (points.length === 0) {
      console.error("⚠️ [Retrieval Agent] No chunks embedded, using raw scraped context.");
      return { retrievedContext: fallbackContext };
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
    const retrievedContext = searchResults.length > 0
      ? searchResults.map((hit: any) => `[Source: ${hit.payload?.url || "Unknown"}]\n${hit.payload?.text || ""}`).join("\n\n---\n\n")
      : fallbackContext;

    console.log(`✅ [Retrieval Agent] Retrieved ${searchResults.length} relevant chunks from Qdrant.`);
    return { retrievedContext };
  } catch (err) {
    console.error("⚠️ [Retrieval Agent] Embedding/Qdrant failed, using raw scraped context:", (err as Error).message);
    return { retrievedContext: fallbackContext };
  }
};