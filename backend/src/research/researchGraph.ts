// backend/src/research/researchGraph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
// ==========================================
// 1. DEFINE THE STATE (Agent Memory)
// ==========================================
// This object gets passed from agent to agent.
const ResearchState = Annotation.Root({
  query: Annotation<string>,             // The user's original research query
  subtasks: Annotation<string[]>,        // Broken down by the Planner
  searchResults: Annotation<any[]>,       // URLs found by Search Agent
  scrapedDocs: Annotation<any[]>,         // Text chunks from Scraper
  retrievedContext: Annotation<string>,  // Relevant text from RAG
  isVerified: Annotation<boolean>,        // Verifier checked facts
  needsMoreResearch: Annotation<boolean>,// Reflector decided to loop back
  loopCount: Annotation<number>,          // Cap loops at 2
  draftReport: Annotation<string>,       // Writer's first draft
  finalReport: Annotation<string>,       // Citation Agent's final output
});

// ==========================================
// 2. DEFINE PLACEHOLDER AGENTS (Nodes)
// ==========================================


const plannerAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Planner Agent] Breaking down query:", state.query);
  
  const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
  
  const prompt = `You are a research planning AI. Break down the following research query into 3 specific, search-engine-friendly subtasks. 
  Return ONLY a JSON array of strings. No markdown, no explanation.
  
  Query: "${state.query}"`;
  
  const result = await model.generateContent(prompt);
  let text = result.response.text().trim();
  
  // Clean up markdown code blocks if the LLM adds them
  if (text.startsWith("```json")) {
    text = text.slice(7, -3).trim();
  } else if (text.startsWith("```")) {
    text = text.slice(3, -3).trim();
  }

  try {
    const subtasks = JSON.parse(text);
    console.log("✅ [Planner Agent] Subtasks created:", subtasks);
    return { subtasks };
  } catch (err) {
    console.error("Planner JSON parse failed, falling back.", err);
    return { subtasks: [state.query] }; // Fallback to just the main query
  }
};


const searchAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Search Agent] Searching web for:", state.subtasks.join(", "));
  
  const allResults: any[] = [];
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

  if (!TAVILY_API_KEY) {
    console.error("Missing TAVILY_API_KEY in .env file!");
    return { searchResults: [] };
  }

  for (const subtask of state.subtasks) {
    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query: subtask,
          max_results: 3,
          search_depth: "advanced",
        }),
      });

      const data = await response.json() as any;

      // Grab the URL and Title
      const mapped = data.results.map((r: any) => ({
        url: r.url,
        title: r.title,
      }));

      allResults.push(...mapped);
    } catch (err) {
      console.error(`Tavily search failed for: ${subtask}`, err);
    }
  }

  // Remove duplicates
  const uniqueResults = Array.from(new Set(allResults.map(r => r.url)))
    .map(url => allResults.find(r => r.url === url));

  console.log(`✅ [Search Agent] Found ${uniqueResults.length} unique URLs.`);
  return { searchResults: uniqueResults };
};



const scraperAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Scraper Agent] Processing documents...");
  return { scrapedDocs: [{ text: "Mock scraped text content." }] };
};

const retrievalAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Retrieval Agent] Embedding and retrieving context...");
  return { retrievedContext: "Mock retrieved context from Qdrant." };
};

const verificationAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Verification Agent] Cross-checking facts...");
  return { isVerified: true };
};

const reflectionAgent = async (state: typeof ResearchState.State) => {
  console.log(`➡️ [Reflection Agent] Evaluating research... (Loop ${state.loopCount})`);
  
  // Mock logic: If this is the first loop, pretend we need more research.
  // If it's the second loop, we have enough info.
  if (state.loopCount < 2) {
    console.log("⤴️ Reflection: Information insufficient. Looping back to Search.");
    return { needsMoreResearch: true, loopCount: state.loopCount + 1 };
  }
  
  console.log("✅ Reflection: Sufficient information gathered.");
  return { needsMoreResearch: false };
};

const writerAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Writer Agent] Drafting structured report...");
  return { draftReport: "This is the mock draft of the report based on " + state.retrievedContext };
};

const citationAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Citation Agent] Mapping claims to sources and finalizing...");
  return { finalReport: state.draftReport + "\n\nCitations: [1] example.com" };
};

// ==========================================
// 3. BUILD THE GRAPH (The Highway)
// ==========================================
const workflow = new StateGraph(ResearchState)
  .addNode("planner", plannerAgent)
  .addNode("search", searchAgent)
  .addNode("scraper", scraperAgent)
  .addNode("retrieval", retrievalAgent)
  .addNode("verification", verificationAgent)
  .addNode("reflection", reflectionAgent)
  .addNode("writer", writerAgent)
  .addNode("citation", citationAgent);

// Define the linear flow
workflow.addEdge(START, "planner");
workflow.addEdge("planner", "search");
workflow.addEdge("search", "scraper");
workflow.addEdge("scraper", "retrieval");
workflow.addEdge("retrieval", "verification");
workflow.addEdge("verification", "reflection");

// Define the conditional loop (Reflection -> Search or Writer)
workflow.addConditionalEdges(
  "reflection",
  (state) => {
    // If reflection says we need more research, route back to search.
    // Otherwise, proceed to the writer.
    return state.needsMoreResearch ? "search" : "writer";
  },
  {
    search: "search",
    writer: "writer",
  }
);

workflow.addEdge("writer", "citation");
workflow.addEdge("citation", END);

// Compile the graph into a runnable function
export const researchPipeline = workflow.compile();