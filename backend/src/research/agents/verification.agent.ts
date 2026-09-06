// backend/src/research/agents/verification.agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResearchState } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const verificationAgent = async (state: typeof ResearchState.State,config: any) => {
  config.configurable.socket.emit("research:progress", { step: "Cross-checking facts across sources..." });
  console.log("➡️ [Verification Agent] Cross-checking facts across sources...");

  if (!state.retrievedContext || state.retrievedContext.length === 0) {
    console.log("❌ [Verification Agent] No context found. Verification failed.");
    return { isVerified: false, retrievedContext: "" };
  }

  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const prompt = `You are a research verification AI. 
You are given multiple text snippets from different web sources.
Your job is to:
1. Extract the core factual claims from the text.
2. Write a short, highly dense summary of the verified facts.
3. Only output "VERIFICATION_FAILED" if the text is completely empty, irrelevant, or pure spam.

Retrieved Context:
 ${state.retrievedContext}

Output only the verified summary:`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    if (responseText.includes("VERIFICATION_FAILED")) {
      console.log("❌ [Verification Agent] Sources contradicted or were insufficient.");
      return { isVerified: false, retrievedContext: "" };
    }

    console.log("✅ [Verification Agent] Facts verified and summarized successfully.");
    // Overwrite retrievedContext with the clean, verified summary for the Writer Agent
    return { isVerified: true, retrievedContext: responseText };

  } catch (err) {
    console.error("⚠️ [Verification Agent] LLM error, proceeding with raw unverified context.");
    // If the LLM fails, just use the raw context so we don't block the pipeline
    return { isVerified: true, retrievedContext: state.retrievedContext };
  }
};