// backend/src/controllers/upload.controller.ts
import { Response } from "express";
import { prisma } from "../prisma/client";
import { AuthRequest } from "../middleware/auth.middleware";
import { processUploadedFile } from "../utils/documentProcessor";
import { pipeline } from "@xenova/transformers";
import { randomUUID } from "crypto";

let extractor: any;
const getExtractor = async () => {
  if (!extractor) {
    extractor = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  }
  return extractor;
};

export async function uploadDocument(req: AuthRequest, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const userId = req.userId as string;
    const file = req.file;

    // 1. Create a ChatSession specifically for this document
    const session = await prisma.chatSession.create({
      data: {
        userId,
        title: `Document: ${file.originalname.slice(0, 30)}`,
      },
    });

    // 2. Extract and chunk text from the file
    const chunks = await processUploadedFile(file);

    // 3. Embed chunks and prepare for Qdrant
    const QDRANT_URL = "http://localhost:6333";
    const COLLECTION_NAME = "research_chunks";
    const embeddingModel = await getExtractor();

    const points = [];
    for (const chunk of chunks) {
      const output = await embeddingModel(chunk, { pooling: "mean", normalize: true });
      points.push({
        id: randomUUID(),
        vector: Array.from(output.data),
        payload: {
          text: chunk,
          url: `local://document/${file.originalname}`,
          queryRef: `Uploaded Document: ${file.originalname}`,
          sessionId: session.id, // Tie it to this specific chat session!
        },
      });
    }

    // 4. Upload to Qdrant
    if (points.length > 0) {
      await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ points }),
      });
    }

    // 5. Add a system message to the chat UI so the user knows it's ready
    await prisma.message.create({
      data: {
        sessionId: session.id,
        role: "assistant",
        content: `I have successfully read your document **${file.originalname}**. It was split into ${chunks.length} chunks. You can now ask me questions about it!`,
      },
    });

    res.status(200).json({ sessionId: session.id, chunks: chunks.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to process document" });
  }
}