// backend/src/middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";

export function errorHandler(err: Error, req: Request, res: Response, next: NextFunction) {
  console.error("Global Error:", err.message);
  
  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  res.status(statusCode).json({
    error: "An internal server error occurred.",
    details: process.env.NODE_ENV === "production" ? null : err.message,
  });
}