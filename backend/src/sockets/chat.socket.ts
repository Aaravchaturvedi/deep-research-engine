// backend/src/sockets/chat.socket.ts
import { Server, Socket } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../prisma/client";
import { classifyIntent } from "../utils/intentClassifier"; // <-- Import the classifier
import { streamChatResponse } from "../utils/llmRouter";
import { searchSessionDocs } from "../utils/vectorStore";
import { isWeatherQuery, getWeatherContext, extractLocation } from "../utils/weather";
import { needsLiveSearch, tavilyLiveSearch, formatTavilyContext } from "../utils/tavily";
import { researchQueue } from "../queues/researchQueue";
import { researchEvents } from "../utils/eventEmitter";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

interface AuthedSocket extends Socket {
  userId?: string;
}

export function registerChatSocket(io: Server) {
  // Bridge worker events back to the originating socket.
  // Registered once here (not per-connection) to avoid listener leaks.
  // The worker has no socket handle, so every event carries socketId.
  researchEvents.removeAllListeners("progress");
  researchEvents.removeAllListeners("complete");
  researchEvents.removeAllListeners("failed");
  researchEvents.on("progress", ({ socketId, step }: any) => {
    io.to(socketId).emit("research:progress", { step });
  });
  researchEvents.on("complete", ({ socketId, fullResponse }: any) => {
    // Keep frontend contract: one chunk + done (worker already saved to DB).
    io.to(socketId).emit("chat:chunk", { chunk: fullResponse });
    io.to(socketId).emit("chat:done", { fullResponse });
  });
  researchEvents.on("failed", ({ socketId, error }: any) => {
    io.to(socketId).emit("chat:error", { error: error || "Research failed" });
  });

  io.use((socket: AuthedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("No token"));
    try {
      const payload = verifyAccessToken(token);
      socket.userId = payload.userId;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket: AuthedSocket) => {
    console.log("Client connected:", socket.id);

    socket.on("chat:message", async ({ message, sessionId }) => {
      try {
        const userId = socket.userId as string;

        let session = sessionId
          ? await prisma.chatSession.findUnique({ where: { id: sessionId } })
          : null;

        if (!session) {
          session = await prisma.chatSession.create({
            data: { userId, title: message.slice(0, 40) },
          });
          socket.emit("chat:session", { sessionId: session.id });
        }

        await prisma.message.create({
          data: { sessionId: session.id, role: "user", content: message },
        });

        // ==========================================
        //  INTENT CLASSIFICATION
        // ==========================================
        const intent = await classifyIntent(message);

        if (intent === "research") {
          // Hand off to the background worker; the result comes back
          // via researchEvents (complete / failed) -> forwarded above.
          console.log("\n-- QUEUEING DEEP RESEARCH JOB --");

          await researchQueue.add(
            "research",
            { query: message, sessionId: session.id, socketId: socket.id },
            { attempts: 1, removeOnComplete: 100, removeOnFail: 100 }
          );

          socket.emit("research:progress", { step: "Research queued, worker picked it up..." });
          return; // Stop here, don't run standard chat
        }

        // ==========================================
        // STANDARD CHAT FLOW (Intent: "chat")
        // Includes session-filtered document context when a doc was uploaded
        // ==========================================
        const history = await prisma.message.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
        });

        const contents = history.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        // Best-effort document retrieval: never break chat if Qdrant is down
        try {
          const docHits = await searchSessionDocs(message, session.id, 5);
          const usable = docHits.filter((h) => h.text && h.text.trim().length > 0);
          if (usable.length > 0) {
            const docContext = usable
              .map((h, i) => `[Doc excerpt ${i + 1} from ${h.url}]\n${h.text}`)
              .join("\n\n---\n\n");
            contents.unshift(
              {
                role: "user",
                parts: [
                  {
                    text:
                      `You are answering about the user's uploaded document. ` +
                      `Use the excerpts below as primary context. If the answer ` +
                      `is not in the excerpts, say so and fall back to general knowledge.\n\n` +
                      `${docContext}`,
                  },
                ],
              },
              {
                role: "model",
                parts: [
                  { text: "Understood. I will prioritize the uploaded document excerpts." },
                ],
              }
            );
          }
        } catch (docErr) {
          console.warn("Doc retrieval skipped:", (docErr as Error).message);
        }

        // ==========================================
        // LIVE DATA (weather via Open-Meteo, else Tavily web search)
        // Best-effort: chat must never break if these fail.
        // ==========================================
        try {
          let liveContext: string | null = null;

          if (isWeatherQuery(message)) {
            try {
              liveContext = await getWeatherContext(message);
            } catch (wErr) {
              console.warn("Weather lookup failed, falling back to Tavily:", (wErr as Error).message);
            }
            if (!liveContext) {
              // No location detected ("weather today?") or Open-Meteo failed:
              // fall back to Tavily so the user still gets something live.
              const live = await tavilyLiveSearch(message);
              if (live && live.hits.length > 0) liveContext = formatTavilyContext(message, live);
              else if (!extractLocation(message)) {
                liveContext =
                  `The user asked about weather but no city/location was detected in: "${message}". ` +
                  `Ask the user which city they mean, and do not guess weather values.`;
              }
            }
          } else if (needsLiveSearch(message)) {
            const live = await tavilyLiveSearch(message);
            if (live && live.hits.length > 0) liveContext = formatTavilyContext(message, live);
          }

          if (liveContext) {
            contents.unshift(
              {
                role: "user",
                parts: [{ text: liveContext }],
              },
              {
                role: "model",
                parts: [{ text: "Understood. I will use the live data above for time-sensitive facts." }],
              }
            );
          }
        } catch (liveErr) {
          console.warn("Live context skipped:", (liveErr as Error).message);
        }

        let fullResponse = "";

        //route instead of calling Gemini directly
        for await (const chunkText of streamChatResponse(contents)) {
          fullResponse += chunkText;
          socket.emit("chat:chunk", { chunk: chunkText });
        }

        await prisma.message.create({
          data: {
            sessionId: session.id,
            role: "assistant",
            content: fullResponse,
          },
        });

        await prisma.chatSession.update({
          where: { id: session.id },
          data: { updatedAt: new Date() },
        });

        socket.emit("chat:done", { fullResponse });
      } catch (err) {
        console.error(err);
        socket.emit("chat:error", { error: "Failed to generate response" });
      }
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
}
