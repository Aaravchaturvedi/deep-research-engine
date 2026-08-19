import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

export async function classifyIntent(message: string): Promise<"chat" | "research"> {
  try {
    // Use the fast model for classification to save time and quota
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
    
    const prompt = `You are an intent classification AI. Read the user's message and classify it into one of two categories:
    - "chat" (for greetings, simple questions, coding help, casual conversation, math, writing, or general knowledge)
    - "research" (for requests that require deep, multi-step web searches, scraping multiple sources, fact-checking, and generating a cited report. e.g., "Write a comprehensive market report on AI in 2024", "Compare the latest research on nuclear fusion", "Find recent news about the SpaceX Starship and summarize")

    User message: "${message}"

    Respond with ONLY ONE WORD: either "chat" or "research". Do not include any other text, punctuation, or formatting.`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim().toLowerCase();

    if (text.includes("research")) {
      return "research";
    }
    
    // Default to chat if the response is ambiguous
    return "chat";
  } catch (error) {
    console.error("Intent classification failed. Defaulting to 'chat'.", error);
    // PRODUCTION SAFETY NET: Always fail gracefully to "chat" so the user isn't blocked
    return "chat";
  }
}