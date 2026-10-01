import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import { syncProcurementRecord } from "../controllers/procurement.controller";
import { authenticate } from "../middleware/authenticate";

export const procurementRouter = Router();

procurementRouter.use(authenticate);
procurementRouter.post("/sync", requirePermission("PROCUREMENT_SYNC"), syncProcurementRecord);