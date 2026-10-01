import { Response } from "express";
import { prisma } from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";

export async function getSessions(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId as string;
    const sessions = await prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
    res.json(sessions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sessions" });
  }
}

export async function getSessionMessages(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string; // <--- Fixed here
    const userId = req.userId as string;

    const session = await prisma.chatSession.findFirst({
      where: { id, userId }, 
    });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const messages = await prisma.message.findMany({
      where: { sessionId: id }, 
      orderBy: { createdAt: "asc" },
    });

    res.json({ session, messages });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

export async function renameSession(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.userId as string;
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 80) : "";
    if (!title) return res.status(400).json({ error: "Title is required" });

    const session = await prisma.chatSession.findFirst({ where: { id, userId } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    const updated = await prisma.chatSession.update({
      where: { id },
      data: { title },
      select: { id: true, title: true, updatedAt: true },
    });
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to rename session" });
  }
}

export async function deleteSession(req: AuthRequest, res: Response) {
  try {
    const id = req.params.id as string;
    const userId = req.userId as string;

    const session = await prisma.chatSession.findFirst({ where: { id, userId } });
    if (!session) return res.status(404).json({ error: "Session not found" });

    // Messages first (no cascade in schema), then the session itself.
    await prisma.message.deleteMany({ where: { sessionId: id } });
    await prisma.chatSession.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete session" });
  }
} 