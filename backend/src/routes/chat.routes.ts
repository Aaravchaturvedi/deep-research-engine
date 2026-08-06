import { Router } from "express";
import { sendMessage } from "../controllers/chat.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.post("/", requireAuth, sendMessage);

export default router;