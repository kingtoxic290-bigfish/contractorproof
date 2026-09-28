import { Router } from "express";
import {
  createCorrection,
  getCorrection,
  listCorrections,
  markCorrectionUnderReview,
  resolveCorrection,
} from "../controllers/corrections.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";

export const correctionsRouter = Router();

correctionsRouter.use(authenticate);
correctionsRouter.get("/", requirePermission("CORRECTION_READ"), listCorrections);
correctionsRouter.post("/", requirePermission("CORRECTION_CREATE"), createCorrection);
correctionsRouter.get("/:correctionId", requirePermission("CORRECTION_READ"), getCorrection);
correctionsRouter.post("/:correctionId/review", requirePermission("CORRECTION_RESOLVE"), markCorrectionUnderReview);
correctionsRouter.post("/:correctionId/resolve", requirePermission("CORRECTION_RESOLVE"), resolveCorrection);
