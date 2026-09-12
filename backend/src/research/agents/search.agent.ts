import { ResearchState } from "../types";

export const searchAgent = async (state: typeof ResearchState.State,config: any) => {
  config.configurable.socket.emit("research:progress", { step: "Searching web for:" });
  console.log("➡️ [Search Agent] Searching web for:", state.subtasks.join(", "));
  const allResults: any[] = [];
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    console.warn("⚠️ [Search Agent] TAVILY_API_KEY not set, skipping web search.");
    return { searchResults: [] };
  }

  for (const subtask of state.subtasks) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({ 
          api_key: TAVILY_API_KEY,
          query: subtask,
          max_results: 5,
          search_depth: "advanced",
          include_answer: true }),
      });
      if (!response.ok) {
        console.error(`Tavily search failed for "${subtask}" (${response.status})`);
        continue;
      }
      const data = await response.json() as any;
      const mapped = (data.results ?? []).map((r: any) => ({
        url: r.url,
        title: r.title ?? r.url,
        content: (r.content ?? "").slice(0, 1500),
      }));
      allResults.push(...mapped);
    } catch (err) {
      console.error(`Tavily search failed for: ${subtask}`, (err as Error).message);
    }
  }
  const uniqueResults = Array.from(new Set(allResults.map(r => r.url))).map(url => allResults.find(r => r.url === url));
  console.log(`✅ [Search Agent] Found ${uniqueResults.length} unique URLs.`);
  return { searchResults: uniqueResults };
};