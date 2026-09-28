import { Router } from "express";
import { createAttestation, listAttestations } from "../controllers/attestations.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";

export const attestationsRouter = Router();

attestationsRouter.use(authenticate);
attestationsRouter.get("/", listAttestations);
attestationsRouter.post("/", requirePermission("ATTEST"), createAttestation);
