import { Router } from "express";
import { authenticate } from "../middleware/authenticate";
import { authorize } from "../middleware/authorize";
import { notImplemented } from "../middleware/errorHandler";

export const blockchainRouter = Router();

blockchainRouter.use(authenticate, authorize("ADMIN", "AUDITOR"));
blockchainRouter.get("/", notImplemented("blockchain"));
