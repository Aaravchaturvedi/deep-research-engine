import { Server, Socket } from "socket.io";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { verifyAccessToken } from "../utils/jwt";
import { prisma } from "../prisma/client";

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

        // 1. Save the user's new message
        await prisma.message.create({
          data: { sessionId: session.id, role: "user", content: message },
        });

        // 2. Fetch ALL messages for this session to give Gemini context
        const history = await prisma.message.findMany({
          where: { sessionId: session.id },
          orderBy: { createdAt: "asc" },
        });

        // 3. Format history into Gemini's expected { role, parts } structure
        // Note: Gemini requires roles to be exactly "user" and "model"
        const contents = history.map((msg) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }));

        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash-lite" });
        
        // 4. Pass the full conversation history to Gemini
        const result = await model.generateContentStream({ contents });

        let fullResponse = "";
        for await (const chunk of result.stream) {
          const chunkText = chunk.text();
          fullResponse += chunkText;
          socket.emit("chat:chunk", { chunk: chunkText });
        }

        // Save the assistant's message
        await prisma.message.create({
          data: { sessionId: session.id, role: "assistant", content: fullResponse },
        });

        // Bump updatedAt on the session
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