import { GoogleGenerativeAI } from "@google/generative-ai";
import { ResearchState } from "../types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export const plannerAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Planner Agent] Breaking down query:", state.query);
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
  const prompt = `You are a research planning AI. Break down the following research query into 3 specific, search-engine-friendly subtasks. Return ONLY a JSON array of strings. No markdown. Query: "${state.query}"`;
  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  if (text.startsWith("```json")) text = text.slice(7, -3).trim();
  else if (text.startsWith("```")) text = text.slice(3, -3).trim();
  try {
    const subtasks = JSON.parse(text);
    console.log("✅ [Planner Agent] Subtasks created:", subtasks);
    return { subtasks };
  } catch (err) {
    return { subtasks: [state.query] };
  }
};