// backend/src/research/researchGraph.ts
import { StateGraph, END, START } from "@langchain/langgraph";
import { ResearchState } from "./types";

// Import real agents
import { plannerAgent } from "./agents/planner.agent";
import { searchAgent } from "./agents/search.agent";
import { scraperAgent } from "./agents/scraper.agent";
import { retrievalAgent } from "./agents/retrieval.agent";
import { verificationAgent } from "./agents/verification.agent";
import { writerAgent } from "./agents/writer.agent";
import { citationAgent } from "./agents/citation.agent";

// --- MOCK AGENTS (To be built in upcoming days) ---d
const reflectionAgent = async (state: typeof ResearchState.State) => {
  console.log(`➡️ [Reflection Agent] Evaluating research... (Loop ${state.loopCount})`);
  if (state.loopCount < 2) {
    console.log("⤴️ Reflection: Information insufficient. Looping back to Search.");
    return { needsMoreResearch: true, loopCount: state.loopCount + 1 };
  }
  console.log("✅ Reflection: Sufficient information gathered.");
  return { needsMoreResearch: false };
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