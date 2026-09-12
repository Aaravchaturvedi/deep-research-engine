// backend/src/utils/tavily.ts
// Fast live web-search for the normal chat path (weather is handled by Open-Meteo).

const TEMPORAL_RE = /\b(today'?s?|right\s+now|currently|live|latest|breaking|this\s+week|yesterday|tomorrow|tonight|2025|2026)\b/i;
const LIVE_TOPIC_RE =
  /\b(news|headline|stock|share\s+price|crypto|bitcoin|score|match\s+result|election|president|prime\s+minister|price\s+of|exchange\s+rate|who\s+won|weather|temperature|forecast)\b/i;

/** True when the message looks time-sensitive and needs the live web. */
export function needsLiveSearch(message: string): boolean {
  if (message.length < 6) return false;
  return TEMPORAL_RE.test(message) || LIVE_TOPIC_RE.test(message);
}

function pickTopic(query: string): "news" | "finance" | "general" {
  if (/\b(news|headline|breaking|election|president|match|score|who\s+won)\b/i.test(query)) return "news";
  if (/\b(stock|crypto|bitcoin|share\s+price|exchange\s+rate|price\s+of)\b/i.test(query)) return "finance";
  return "general";
}

export interface TavilyHit {
  url: string;
  title: string;
  content: string;
}

/**
 * Single fast Tavily call for chat. Returns null on any failure
 * (missing key, timeout, API error) — chat must never break because of this.
 */
export async function tavilyLiveSearch(query: string): Promise<{ answer: string; hits: TavilyHit[] } | null> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    console.warn("Tavily skipped: TAVILY_API_KEY not set");
    return null;
  }

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(9000),
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: "basic", // fast path for chat; research pipeline uses advanced
        topic: pickTopic(query),
        time_range: TEMPORAL_RE.test(query) ? "day" : undefined,
        max_results: 5,
        include_answer: true,
      }),
    });
    if (!res.ok) {
      console.warn(`Tavily live search failed (${res.status})`);
      return null;
    }
    const data = (await res.json()) as any;
    const hits: TavilyHit[] = (data.results ?? []).map((r: any) => ({
      url: r.url,
      title: r.title ?? r.url,
      content: (r.content ?? "").slice(0, 800),
    }));
    return { answer: data.answer ?? "", hits };
  } catch (err) {
    console.warn("Tavily live search error:", (err as Error).message);
    return null;
  }
}

export function formatTavilyContext(query: string, result: { answer: string; hits: TavilyHit[] }): string {
  const fetchedAt = new Date().toISOString();
  const lines = result.hits.map((h, i) => `[${i + 1}] ${h.title} (${h.url}): ${h.content}`);
  return (
    `LIVE WEB RESULTS (source: Tavily search, fetched at ${fetchedAt}). ` +
    `Use these to answer "${query}". Prefer these over training data for anything time-sensitive. ` +
    `Cite URLs when stating facts.\n` +
    (result.answer ? `Summary answer: ${result.answer}\n` : "") +
    lines.join("\n")
  );
}
