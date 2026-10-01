import { Router } from "express";
import { getSessions, getSessionMessages, renameSession, deleteSession } from "../controllers/session.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.get("/", requireAuth, getSessions);
router.get("/:id", requireAuth, getSessionMessages);
router.patch("/:id", requireAuth, renameSession);
router.delete("/:id", requireAuth, deleteSession);

export default router;