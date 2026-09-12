// backend/src/routes/upload.routes.ts
import { Router } from "express";
import multer from "multer";
import { uploadDocument } from "../controllers/upload.controller";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// Configure multer to store files in memory (not on disk)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 1 }, // 15MB max, single file
  fileFilter: (_req, file, cb) => {
    const allowed = new Set([
      "application/pdf",
      "text/plain",
      "text/csv",
      "application/octet-stream",
      "application/vnd.ms-excel",
    ]);
    const ext = (file.originalname.split(".").pop() || "").toLowerCase();
    if (allowed.has(file.mimetype) || ["pdf", "txt", "csv"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Unsupported file type. Please upload PDF, TXT, or CSV."));
    }
  },
});

router.post("/", requireAuth, upload.single("document"), uploadDocument);

export default router;