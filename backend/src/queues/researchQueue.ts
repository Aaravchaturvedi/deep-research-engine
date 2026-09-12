// backend/src/queues/researchQueue.ts
// Queue + Worker for deep-research jobs.
// Socket layer only does researchQueue.add(); this worker runs the pipeline
// and reports back through researchEvents (progress / complete / failed).
import dotenv from "dotenv";
dotenv.config();

import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";
import { prisma } from "../prisma/client";
import { researchPipeline } from "../research/researchGraph";
import { researchEvents } from "../utils/eventEmitter";

researchEvents.setMaxListeners(0);

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ Workers use a blocking connection, so the Queue and Worker
// must NOT share one Redis instance.
const queueConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
const workerConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null });

export const researchQueue = new Queue("researchQueue", { connection: queueConnection });

export interface ResearchJobData {
  query: string;
  sessionId: string;
  socketId: string;
}

export const researchWorker = new Worker(
  "researchQueue",
  async (job) => {
    const { query, sessionId, socketId } = job.data as ResearchJobData;

    // Agents expect a socket-like object; bridge progress into the EventEmitter
    // so chat.socket.ts can forward it to the right client.
    const mockSocket = {
      emit: (event: string, data: any) => {
        if (event === "research:progress") {
          researchEvents.emit("progress", { socketId, step: data.step });
        }
      },
    };

    try {
      const finalState = await researchPipeline.invoke(
        {
          query,
          subtasks: [],
          searchResults: [],
          scrapedDocs: [],
          retrievedContext: "",
          isVerified: false,
          needsMoreResearch: false,
          loopCount: 1,
          draftReport: "",
          finalReport: "",
        },
        { configurable: { socket: mockSocket } }
      );

      const fullResponse = finalState.finalReport || "I could not generate a report on this topic.";

      // Persist here — the socket layer only relays, never re-saves.
      await prisma.message.create({
        data: { sessionId, role: "assistant", content: fullResponse },
      });

      await prisma.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });

      researchEvents.emit("complete", { socketId, sessionId, fullResponse });
      return { socketId, sessionId };
    } catch (err) {
      const message = (err as Error).message || "Research pipeline failed";
      console.error(`Research job ${job.id} error:`, message);
      researchEvents.emit("failed", { socketId, sessionId, error: message });
      throw err; // let BullMQ mark the job failed (retry policy applies)
    }
  },
  // Research jobs run for MINUTES (LLM calls + scraping), far longer than
  // BullMQ's 30s default lock. A short lock expires mid-job, and completion
  // then fails with "Lock mismatch ... moveToFinished". Renew less often,
  // hold the lock longer, one job at a time.
  { connection: workerConnection, concurrency: 1, lockDuration: 300000, stalledInterval: 60000 }
);

researchWorker.on("completed", (job) => {
  console.log(`Research job ${job.id} completed successfully.`);
});

researchWorker.on("failed", (job, err) => {
  console.error(`Research job ${job?.id} failed:`, err.message);
});
