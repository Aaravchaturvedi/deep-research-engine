// backend/src/research/researchGraph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { Annotation } from "@langchain/langgraph";

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
  return { subtasks: ["Subtask 1", "Subtask 2"] };
};

const searchAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Search Agent] Searching web for:", state.subtasks.join(", "));
  return { searchResults: [{ url: "https://example.com", title: "Mock Result" }] };
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