import { Router } from "express";
import { createEvidence, listEvidence } from "../controllers/evidence.controller";
import { requirePermission } from "../authz/permissions";
import { requireMultipartFile } from "../http/multipart";
import { authenticate } from "../middleware/authenticate";

export const evidenceRouter = Router();

evidenceRouter.use(authenticate);

evidenceRouter.get("/", requirePermission("EVIDENCE_READ"), listEvidence);

evidenceRouter.post("/", requirePermission("EVIDENCE_UPLOAD"), requireMultipartFile, createEvidence);
