import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { notImplemented } from "../middleware/errorHandler";

export const variationsRouter = Router();

variationsRouter.use(authenticate);
variationsRouter.get("/", notImplemented("variations"));
variationsRouter.post("/", notImplemented("variations"));
