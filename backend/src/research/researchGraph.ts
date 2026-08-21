// backend/src/research/researchGraph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ResearchState } from "./types";

// Import real agents
import { plannerAgent } from "./agents/planner.agent";
import { searchAgent } from "./agents/search.agent";
import { scraperAgent } from "./agents/scraper.agent";
import { retrievalAgent } from "./agents/retrieval.agent";

// --- MOCK AGENTS (To be built in upcoming days) ---
const verificationAgent = async (state: typeof ResearchState.State) => {
  console.log("➡️ [Verification Agent] Cross-checking facts...");
  return { isVerified: true };
};
const reflectionAgent = async (state: typeof ResearchState.State) => {
  console.log(`➡️ [Reflection Agent] Evaluating research... (Loop ${state.loopCount})`);
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

// --- BUILD THE GRAPH ---
const workflow = new StateGraph(ResearchState)
  .addNode("planner", plannerAgent)
  .addNode("search", searchAgent)
  .addNode("scraper", scraperAgent)
  .addNode("retrieval", retrievalAgent)
  .addNode("verification", verificationAgent)
  .addNode("reflection", reflectionAgent)
  .addNode("writer", writerAgent)
  .addNode("citation", citationAgent);

workflow.addEdge(START, "planner");
workflow.addEdge("planner", "search");
workflow.addEdge("search", "scraper");
workflow.addEdge("scraper", "retrieval");
workflow.addEdge("retrieval", "verification");
workflow.addEdge("verification", "reflection");

workflow.addConditionalEdges(
  "reflection",
  (state) => (state.needsMoreResearch ? "search" : "writer"),
  { search: "search", writer: "writer" }
);

workflow.addEdge("writer", "citation");
workflow.addEdge("citation", END);

export const researchPipeline = workflow.compile();