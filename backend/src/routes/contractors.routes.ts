import { Router } from "express";
import { getContractor, listContractors } from "../controllers/contractors.controller";
import { authenticate } from "../middleware/authenticate";

export const contractorsRouter = Router();

// Authentication is required. No contractor-specific role policy exists in
// the frozen specification or current routes, so authorize() is not applied.
contractorsRouter.use(authenticate);
contractorsRouter.get("/", listContractors);
contractorsRouter.get("/:contractorId", getContractor);
