// backend/src/controllers/upload.controller.ts
import { Response } from "express";
import { prisma } from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { processUploadedFile } from "../utils/documentProcessor";
import {
  ensureCollection,
  getExtractor,
  upsertPoints,
} from "../utils/vectorStore";
import { randomUUID } from "crypto";

export async function uploadDocument(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.userId as string;
    const file = req.file;

    // 1. Extract and chunk text FIRST (fail fast, no orphan session on bad file)
    const chunks = await processUploadedFile(file);
    if (chunks.length === 0) {
      return res.status(400).json({ error: "No readable text found in file" });
    }

    // 2. Attach to the open session when provided; otherwise create one.
    //    This keeps the user in their current chat instead of yanking them away.
    const requestedSessionId =
      typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
        ? req.body.sessionId.trim()
        : null;

    let session: { id: string };
    let isNewSession = false;
    if (requestedSessionId) {
      const existing = await prisma.chatSession.findFirst({
        where: { id: requestedSessionId, userId },
        select: { id: true },
      });
      if (!existing) {
        return res.status(404).json({ error: "Session not found" });
      }
      session = existing;
    } else {
      session = await prisma.chatSession.create({
        data: {
          userId,
          title: `Document: ${file.originalname.slice(0, 30)}`,
        },
      });
      isNewSession = true;
    }

    try {
      // 3. Ensure Qdrant collection exists (was silently failing before)
      await ensureCollection();

      // 4. Embed chunks and prepare for Qdrant
      const embeddingModel = await getExtractor();

      const points: { id: string; vector: number[]; payload: Record<string, any> }[] = [];
      for (const chunk of chunks) {
        const output = await embeddingModel(chunk, { pooling: "mean", normalize: true });
        points.push({
          id: randomUUID(),
          vector: Array.from(output.data as Float32Array) as number[],
          payload: {
            text: chunk,
            url: `local://document/${file.originalname}`,
            queryRef: `Uploaded Document: ${file.originalname}`,
            sessionId: session.id, // Tie it to this specific chat session!
          },
        });
      }

      // 5. Upload to Qdrant (throws on failure — checked, unlike before)
      await upsertPoints(points);
    } catch (vectorErr) {
      // Only roll back sessions WE created. Never delete a user's existing
      // chat (with history) just because the vector write failed.
      if (isNewSession) {
        await prisma.chatSession.delete({ where: { id: session.id } }).catch(() => {});
      }
      throw vectorErr;
    }

    // 5. Add a system message to the chat UI so the user knows it's ready
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: `I have successfully read your document **${file.originalname}**. It was split into ${chunks.length} chunks. You can now ask me questions about it!`,
      },
    });

    res.status(200).json({
      sessionId: session.id,
      chunks: chunks.length,
      filename: file.originalname,
      newSession: isNewSession,
    });
  } catch (err: any) {
    console.error("uploadDocument failed:", err);
    const raw = err?.message || "Failed to process document";
    const isClientError =

      raw === "Unsupported file type. Please upload PDF, TXT, or CSV." ||
      raw === "No readable text found in file" ||
      raw.startsWith("Could not parse this PDF");
    const message = isClientError
      ? raw
      : raw.startsWith("Qdrant") || raw.startsWith("Failed to ensure Qdrant")
        ? `Document parsed but vector DB write failed: ${raw}`
        : "Failed to process document";
    res.status(isClientError ? 400 : 500).json({ error: message });
  }
}