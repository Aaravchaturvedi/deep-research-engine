import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import http from "http";
import { Server } from "socket.io";
import { prisma } from "./prisma/client";
import authRoutes from "./routes/auth.routes";
import chatRoutes from "./routes/chat.routes";
import { apiLimiter } from "./middleware/rateLimiter.middleware";
import { errorHandler } from "./middleware/errorHandler.middleware";
import { requireAuth, AuthRequest } from "./middleware/auth.middleware";
import { registerChatSocket } from "./sockets/chat.socket";
import sessionRoutes from "./routes/session.routes";

const app = express();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "http://localhost:5173", credentials: true },
});

app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(cookieParser());
app.use(express.json());

app.get("/health", async (_req, res) => {
  const userCount = await prisma.user.count();
  res.json({ status: "ok", userCount });
});

app.use("/api",apiLimiter);

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes); // keep the old REST endpoint as a fallback/for Day 6
app.use("/api/sessions", sessionRoutes);

app.use(errorHandler);

app.get("/api/me", requireAuth, async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  res.json({ id: user?.id, email: user?.email, name: user?.name });
});

registerChatSocket(io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));