import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import { getContractor, listContractors } from "../controllers/contractors.controller";
import {
  getContractorCrbVerifications,
  verifyContractorWithCrb,
} from "../controllers/crb.controller";
import { authenticate } from "../middleware/authenticate";
import { linkProcurementRecord, listContractorProcurement } from "../controllers/procurement.controller";

export const contractorsRouter = Router();

// Authentication is required for all contractor routes.
contractorsRouter.use(authenticate);

// CRB sub-resource is declared before "/:contractorId" so the concrete path is
// always matched. Reading is permitted for a contractor's own record; running a
// check is not, so a contractor cannot manufacture a result.
contractorsRouter.get(
  "/:contractorId/crb",
  requirePermission("CRB_READ"),
  getContractorCrbVerifications,
);
contractorsRouter.post(
  "/:contractorId/crb/verify",
  requirePermission("CRB_VERIFY"),
  verifyContractorWithCrb,
);
contractorsRouter.get(
  "/:contractorId/procurement",
  requirePermission("PROCUREMENT_READ"),
  listContractorProcurement,
);
contractorsRouter.post(
  "/:contractorId/procurement/:recordId/link",
  requirePermission("PROCUREMENT_LINK"),
  linkProcurementRecord,
);

contractorsRouter.get("/", listContractors);
contractorsRouter.get("/:contractorId", getContractor);