import { GoogleGenerativeAI, TaskType } from "@google/generative-ai";
import { randomUUID } from "crypto";
import { ResearchState } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const retrievalAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Retrieval Agent] Embedding and retrieving context...");
  const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  const QDRANT_URL = "http://localhost:6333";
  const COLLECTION_NAME = "research_chunks";

  try {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vectors: { size: 768, distance: "Cosine" } }),
    });
  } catch (err) { /* Ignore if exists */ }

  console.log(`Embedding ${state.scrapedDocs.length} chunks in parallel...`);
  const pointPromises = state.scrapedDocs.map(async (doc) => {
    try {
      const embedResult = await embeddingModel.embedContent({
        content: { role: "user", parts: [{ text: doc.text }] },
        taskType: TaskType.RETRIEVAL_DOCUMENT,
      });
      return {
        id: randomUUID(),
        vector: embedResult.embedding.values,
        payload: { text: doc.text, url: doc.url, queryRef: state.query, loopCount: state.loopCount },
      };
    } catch (err) { return null; }
  });

  const points = (await Promise.all(pointPromises)).filter((point): point is NonNullable<typeof point> => point !== null);

  if (points.length > 0) {
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ points }),
    });
  }

  const queryEmbedResult = await embeddingModel.embedContent({
    content: { role: "user", parts: [{ text: state.query }] },
    taskType: TaskType.RETRIEVAL_QUERY,
  });

  const searchResponse = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vector: queryEmbedResult.embedding.values, limit: 5, with_payload: true }),
  });

  const searchData = await searchResponse.json() as any;
  const searchResults = searchData.result || [];
  const retrievedContext = searchResults.map((hit: any) => `[Source: ${hit.payload?.url || "Unknown"}]\n${hit.payload?.text || ""}`).join("\n\n---\n\n");

  console.log(`✅ [Retrieval Agent] Retrieved ${searchResults.length} relevant chunks from Qdrant.`);
  return { retrievedContext };
};