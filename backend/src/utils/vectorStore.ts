// backend/src/utils/vectorStore.ts
// Shared Qdrant + local embedding helpers. Single source of truth for
// collection name, vector size, and session-filtered retrieval.

export const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
export const COLLECTION_NAME = "research_chunks";
export const VECTOR_SIZE = 384; // Xenova/all-MiniLM-L6-v2 output dims

let extractor: any;
export const getExtractor = async () => {
  if (!extractor) {
    // Dynamic import: @xenova/transformers is ESM-only, static import
    // breaks `tsc --noEmit` under NodeNext without "type": "module".
    const { pipeline } = await import("@xenova/transformers");
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
};

export async function ensureCollection(): Promise<void> {
  // GET first so we don't wipe/recreate on every call; PUT creates if missing.
  try {
    const existing = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`);
    if (existing.ok) return;
  } catch {
    // Qdrant unreachable — let the PUT below throw a clear error.
  }

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vectors: { size: VECTOR_SIZE, distance: "Cosine" } }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to ensure Qdrant collection (${res.status}): ${text}`);
  }
}

export async function upsertPoints(
  points: { id: string; vector: number[]; payload: Record<string, any> }[]
): Promise<void> {
  if (points.length === 0) return;
  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ points }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Qdrant upsert failed (${res.status}): ${text}`);
  }
  const data = (await res.json().catch(() => null)) as any;
  if (data && data.status && data.status !== "ok") {
    throw new Error(`Qdrant upsert returned status: ${JSON.stringify(data.status)}`);
  }
}

/** Embed query text and return top-k chunks for a given chat session. */
export async function searchSessionDocs(
  queryText: string,
  sessionId: string,
  limit = 5
): Promise<{ text: string; url: string }[]> {
  const model = await getExtractor();
  const output = await model(queryText, { pooling: "mean", normalize: true });
  const queryVector = Array.from(output.data as Float32Array) as number[];

  const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      vector: queryVector,
      limit,
      with_payload: true,
      filter: { must: [{ key: "sessionId", match: { value: sessionId } }] },
    }),
  });
  if (!res.ok) {
    // Collection may not exist yet (no docs uploaded) — treat as no context.
    if (res.status === 404) return [];
    const text = await res.text().catch(() => "");
    throw new Error(`Qdrant search failed (${res.status}): ${text}`);
  }
  const data = (await res.json()) as any;
  const hits = data?.result || [];
  return hits.map((hit: any) => ({
    text: hit.payload?.text || "",
    url: hit.payload?.url || "Unknown",
  }));
}
