// backend/src/utils/llmRouter.ts
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// This function yields text chunks, so it works perfectly with your socket streaming
export async function* streamChatResponse(history: any[]) {
  try {
    // 1. Try your working current model FIRST
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    const result = await model.generateContentStream({ contents: history });
    
    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  } catch (error: any) {
    console.error("Gemini failed:", error.message);
    
    // 2. If Gemini fails, fall back to Groq
    console.log("Falling back to Groq...");
    
    // Groq uses the OpenAI SDK format, so we map the Gemini history to Groq's format
    const messages = history.map((msg) => ({
      role: (msg.role === "model" ? "assistant" : "user") as "assistant",
      content: msg.parts[0].text,
    }));

    const stream = await groq.chat.completions.create({
      model: "qwen/qwen3.6-27b", // Fast Groq model
      messages,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || "";
      if (text) yield text;
    }
  }
}