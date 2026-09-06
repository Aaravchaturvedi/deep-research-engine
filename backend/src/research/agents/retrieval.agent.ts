// backend/src/research/agents/retrieval.agent.ts
import { pipeline } from "@xenova/transformers";
import { randomUUID } from "crypto";
import { ResearchState } from "../types";

// Initialize the local embedding model
let extractor: any;
const getExtractor = async () => {
  if (!extractor) {
    console.log("Loading local embedding model...");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
};

export const retrievalAgent = async (state: typeof ResearchState.State,config: any) => {
  config.configurable.socket.emit("research:progress", { step: "Embedding and retrieving context (Local Model)..." });
  console.log("➡️ [Retrieval Agent] Embedding and retrieving context (Local Model)...");
  const extractor = await getExtractor();
  
  const QDRANT_URL = "http://localhost:6333";
  const COLLECTION_NAME = "research_chunks";
  const VECTOR_SIZE = 384; // all-MiniLM-L6-v2 outputs 384 dimensions

  // 1. Ensure the Qdrant collection exists (Size 384 for the local model)
  try {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vectors: { size: VECTOR_SIZE, distance: "Cosine" } }),
    });
  } catch (err) { /* Ignore if exists */ }

  // 2. Embed scraped chunks sequentially
  console.log(`Embedding ${state.scrapedDocs.length} chunks locally...`);
  const points = [];
  
  for (let i = 0; i < state.scrapedDocs.length; i++) {
    const doc = state.scrapedDocs[i];
    try {
      // Local model embedding
      const output = await extractor(doc.text, { pooling: "mean", normalize: true });
      const vector = Array.from(output.data); // Convert to standard array

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
  if (points.length > 0) {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
  }

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