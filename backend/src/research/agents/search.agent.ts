import { ResearchState } from "../types";

export const searchAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Search Agent] Searching web for:", state.subtasks.join(", "));
  const allResults: any[] = [];
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  for (const subtask of state.subtasks) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          api_key: TAVILY_API_KEY,
          query: subtask,
          max_results: 3,
          search_depth: "advanced" }),
      });
      const data = await response.json() as any;
      const mapped = data.results.map((r: any) => ({ url: r.url, title: r.title }));
      allResults.push(...mapped);
    } catch (err) {
      console.error(`Tavily search failed for: ${subtask}`);
    }
  }
  const uniqueResults = Array.from(new Set(allResults.map(r => r.url))).map(url => allResults.find(r => r.url === url));
  console.log(`✅ [Search Agent] Found ${uniqueResults.length} unique URLs.`);
  return { searchResults: uniqueResults };
};