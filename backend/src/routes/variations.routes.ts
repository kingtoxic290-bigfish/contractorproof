import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import { createVariation, getVariation, listVariations, resolveVariation, reviewVariation } from "../controllers/variations.controller";
import { authenticate } from "../middleware/authenticate";

export const variationsRouter = Router();

variationsRouter.use(authenticate);
variationsRouter.get("/", requirePermission("VARIATION_READ"), listVariations);
variationsRouter.post("/", requirePermission("VARIATION_CREATE"), createVariation);
variationsRouter.get("/:variationId", requirePermission("VARIATION_READ"), getVariation);
variationsRouter.post("/:variationId/review", requirePermission("VARIATION_RESOLVE"), reviewVariation);
variationsRouter.post("/:variationId/resolve", requirePermission("VARIATION_RESOLVE"), resolveVariation);
