// backend/src/sockets/chat.socket.ts
import { Server, Socket } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../prisma/client";
import { classifyIntent } from "../utils/intentClassifier"; // <-- Import the classifier

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);

interface AuthedSocket extends Socket {
  userId?: string;
}

export function registerChatSocket(io: Server) {
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
          // Placeholder until Day 9 (LangGraph pipeline)
          const mockResponse = `[Research Mode Triggered]: I would normally spin up the multi-agent pipeline to search the web, scrape documents, and write a cited report for: "${message}". Coming soon!`;
          
          // Stream the mock response just to test the UI
          socket.emit("chat:chunk", { chunk: mockResponse });

          await prisma.message.create({
            data: { sessionId: session.id, role: "assistant", content: mockResponse },
          });

          await prisma.chatSession.update({
            where: { id: session.id },
            data: { updatedAt: new Date() },
          });

          socket.emit("chat:done", { fullResponse: mockResponse });
          return; // Stop here, don't run standard chat
        }

        // ==========================================
        // STANDARD CHAT FLOW (Intent: "chat")
        // ==========================================
        const history = await prisma.message.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
        });

        const contents = history.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        const result = await model.generateContentStream({ contents });

        let fullResponse = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          socket.emit("chat:chunk", { chunk: chunkText });
        }

        await prisma.message.create({
          data: { sessionId: session.id, role: "assistant", content: fullResponse },
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