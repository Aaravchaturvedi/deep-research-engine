import { Router } from "express";
import { getSessions, getSessionMessages } from "../controllers/session.controller";
import { requireAuth } from "../middleware/auth.middleware";

const router = Router();
router.get("/", requireAuth, getSessions);
router.get("/:id", requireAuth, getSessionMessages);

export default router;