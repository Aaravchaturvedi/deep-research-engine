import { Annotation } from "@langchain/langgraph";

export const ResearchState = Annotation.Root({
  query: Annotation<string>,
  subtasks: Annotation<string[]>,
  searchResults: Annotation<any[]>,
  scrapedDocs: Annotation<any[]>,
  retrievedContext: Annotation<string>,
  isVerified: Annotation<boolean>,
  needsMoreResearch: Annotation<boolean>,
  loopCount: Annotation<number>,
  draftReport: Annotation<string>,
  finalReport: Annotation<string>,
});