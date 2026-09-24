import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { notImplemented } from "../middleware/errorHandler";

export const passportsRouter = Router();

passportsRouter.use(authenticate);
passportsRouter.get("/", notImplemented("passports"));
passportsRouter.get("/:projectId", notImplemented("passports"));
