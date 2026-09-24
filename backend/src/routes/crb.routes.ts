import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { lookupCrb } from "../controllers/integrations.controller";

export const crbRouter = Router();

crbRouter.use(authenticate);
crbRouter.get("/:registrationNumber", lookupCrb);
