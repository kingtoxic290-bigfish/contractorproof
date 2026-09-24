import { Router } from "express";
import { createDispute, listDisputes } from "../controllers/disputes.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";

export const disputesRouter = Router();

disputesRouter.use(authenticate);
disputesRouter.get("/", requirePermission("DISPUTE_READ"), listDisputes);
disputesRouter.post("/", requirePermission("DISPUTE_CREATE"), createDispute);
