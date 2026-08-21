import * as cheerio from "cheerio";
import axios from "axios";
import { ResearchState } from "../types";

export const scraperAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Scraper Agent] Fetching and processing documents...");
  const scrapedDocs: { url: string, text: string }[] = [];

  for (const result of state.searchResults) {
    try {
      const response = await axios.get(result.url, { timeout: 5000, headers: { 'User-Agent': 'Mozilla/5.0 (DeepResearchBot)' } });
      const $ = cheerio.load(response.data);
      $("script, style, nav, footer, header, iframe").remove();
      const text = $("body").text().replace(/\s+/g, " ").trim();
      
      const chunkSize = 2000;
      for (let i = 0; i < text.length; i += chunkSize) {
        scrapedDocs.push({ url: result.url, text: text.slice(i, i + chunkSize) });
      }
    } catch (err) {
      console.error(`⚠️ [Scraper Agent] Failed to scrape ${result.url}`);
    }
  }
  console.log(`✅ [Scraper Agent] Extracted ${scrapedDocs.length} text chunks.`);
  return { scrapedDocs };
};