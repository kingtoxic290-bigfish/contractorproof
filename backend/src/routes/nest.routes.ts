import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { lookupNest } from "../controllers/integrations.controller";

export const nestRouter = Router();

nestRouter.use(authenticate);
nestRouter.get("/:reference", lookupNest);
