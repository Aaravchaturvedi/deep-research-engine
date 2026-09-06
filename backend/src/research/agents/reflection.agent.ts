// backend/src/research/agents/reflection.agent.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResearchState } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const reflectionAgent = async (state: typeof ResearchState.State, config: any) => {
  config.configurable.socket.emit("research:progress", { step: `Evaluating research (Loop ${state.loopCount})...` });
  console.log(`➡️ [Reflection Agent] Evaluating research... (Loop ${state.loopCount})`);

  // 1. Hard cap: Force completion if we've already looped twice
  if (state.loopCount >= 2) {
    console.log("✅ Reflection: Max loops reached. Forcing completion.");
    return { needsMoreResearch: false };
  }

  // 2. If verification failed or we have no context, immediately loop back
  if (!state.isVerified || !state.retrievedContext || state.retrievedContext.length === 0) {
    console.log("⤴️ Reflection: Verification failed or no context. Looping back to Search.");
    return { needsMoreResearch: true, loopCount: state.loopCount + 1 };
  }

  // 3. Use LLM to decide if the context is actually good enough
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });

  const prompt = `You are a strict research reflection AI. 
  Based on the user's original query and the verified context provided, evaluate if we have enough information to write a comprehensive report.
  - If the context is empty, irrelevant, or insufficient to answer the query, output exactly "NEEDS_MORE_RESEARCH".
  - If the context is sufficient and relevant, output exactly "SUFFICIENT".

  Original Query: ${state.query}
  Verified Context: ${state.retrievedContext.substring(0, 2000)}... 

  Evaluation:`;

  try {
    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim().toUpperCase();

    if (responseText.includes("NEEDS_MORE_RESEARCH")) {
      console.log("⤴️ Reflection: Information insufficient. Looping back to Search.");
      return { needsMoreResearch: true, loopCount: state.loopCount + 1 };
    }

    console.log("✅ Reflection: Sufficient information gathered.");
    return { needsMoreResearch: false };
  } catch (err) {
    console.error("⚠️ [Reflection Agent] LLM error, forcing completion to prevent loop.", err);
    // Fail forward to avoid getting stuck in an infinite loop if the API fails
    return { needsMoreResearch: false }; 
  }
};