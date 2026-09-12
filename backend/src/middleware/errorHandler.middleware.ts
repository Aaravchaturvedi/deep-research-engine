// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error("Global Error:", err.message);

  // Multer file-size / file-type errors should be 400, not 500
  if (err?.code === "LIMIT_FILE_SIZE") {
    res.status(400).json({ error: "File too large. Max 15MB." });
    return;
  }
  if (err?.code?.startsWith?.("LIMIT_") || err?.message?.startsWith?.("Unsupported file type")) {
    res.status(400).json({ error: err.message });
    return;
  }

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    error: "An internal server error occurred.",
    details: process.env.NODE_ENV === "production" ? null : err.message,
  });
}