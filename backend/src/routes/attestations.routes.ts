import { Router } from "express";
import { createAttestation } from "../controllers/attestations.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";
import { notImplemented } from "../middleware/errorHandler";

export const attestationsRouter = Router();

attestationsRouter.use(authenticate);
attestationsRouter.get("/", notImplemented("attestations"));
attestationsRouter.post("/", requirePermission("ATTEST"), createAttestation);
