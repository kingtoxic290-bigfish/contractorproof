import { Router } from "express";
import { createCorrection, listCorrections } from "../controllers/corrections.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";

export const correctionsRouter = Router();

correctionsRouter.use(authenticate);
correctionsRouter.get("/", requirePermission("CORRECTION_READ"), listCorrections);
correctionsRouter.post("/", requirePermission("CORRECTION_CREATE"), createCorrection);
