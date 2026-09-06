// backend/src/research/agents/citation.agent.ts
import { ResearchState } from "../types";

export const citationAgent = async (state: typeof ResearchState.State,config: any) => {
  config.configurable.socket.emit("research:progress", { step: "Mapping claims to sources and finalizing report..." });
  console.log("➡️ [Citation Agent] Mapping claims to sources and finalizing...");

  let draftText = state.draftReport;
  
  // 1. Extract all unique URLs from BOTH retrieved context and search results
  const urlRegex = /(https?:\/\/[^\s\n\]]+)/g;
  const contextUrls = state.retrievedContext.match(urlRegex) || [];
  const searchUrls = state.searchResults.map((r: any) => r.url);
  
  const urls = [...new Set([...contextUrls, ...searchUrls])];

  if (urls.length === 0) {
    console.log("⚠️ [Citation Agent] No URLs found to cite.");
    return { finalReport: draftText };
  }

  // 2. Replace inline URLs in the draft with numbered citations [1], [2], etc.
  const urlMap: Record<string, number> = {};
  urls.forEach((url, index) => {
    const citationNumber = index + 1;
    urlMap[url] = citationNumber;
    
    // Escape URL for regex
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    
    // Replace [https://url.com] with [1]
    draftText = draftText.replace(new RegExp(`\\[${escapedUrl}\\]`, "g"), `[${citationNumber}]`);
    // Replace raw https://url.com with [1]
    draftText = draftText.replace(new RegExp(escapedUrl, "g"), `[${citationNumber}]`);
  });

  // 3. Append the Sources section at the very bottom
  let sourcesSection = "\n\n---\n\n### Sources\n";
  for (const [url, num] of Object.entries(urlMap)) {
    sourcesSection += `${num}. ${url}\n`;
  }

  const finalReport = draftText + sourcesSection;

  console.log("✅ [Citation Agent] Report finalized with citations.");
  return { finalReport };
};