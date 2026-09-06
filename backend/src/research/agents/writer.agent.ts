// backend/src/research/agents/writer.agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResearchState } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const writerAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Writer Agent] Drafting structured report...");

  if (!state.retrievedContext || state.retrievedContext.length === 0) {
    console.log("⚠️ [Writer Agent] No context available to write report.");
    return { draftReport: "I could not find enough verified information to write a report on this topic." };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

   const availableUrls = state.searchResults.map((r: any) => r.url).join("\n");

  const prompt = `You are an expert research assistant. Based on the verified context provided below, write a comprehensive, structured report answering the user's original query.

Requirements:
1. Use Markdown formatting (H1, H2, bullet points, bold text).
2. Structure: Include an "Executive Summary", "Key Findings", and "Conclusion".
3. ONLY use the information provided in the context. Do not hallucinate or use outside knowledge.
4. At the end of every factual sentence or statistic, cite the source URL in brackets like this: [https://example.com].
5. ONLY use URLs from this approved list. Do not make up URLs:
 ${availableUrls}
 
Original Query: ${state.query}

Verified Context:
 ${state.retrievedContext}

Write the report now:`;

  try {
    const result = await model.generateContent(prompt);
    const draftReport = result.response.text().trim();
    console.log("✅ [Writer Agent] Report drafted successfully.");
    return { draftReport };
  } catch (err) {
    console.error("⚠️ [Writer Agent] LLM error, generating fallback report.", err);
    return { draftReport: "Failed to generate report due to an LLM error." };
  }
};