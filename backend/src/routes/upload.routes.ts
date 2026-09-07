// backend/src/routes/upload.routes.ts
import { Router } from "express";
import multer from "multer";
import { uploadDocument } from "../controllers/upload.controller";
import { requireAuth, AuthRequest } from "../middleware/auth.middleware";

const router = Router();

// Configure multer to store files in memory (not on disk)
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", requireAuth, upload.single("document"), uploadDocument);

export default router;