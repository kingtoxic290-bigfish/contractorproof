import { Router } from "express";
import { createVerification } from "../controllers/verification.controller";
import { requirePermission } from "../authz/permissions";
import { acceptOptionalFile } from "../http/multipart";
import { authenticate } from "../middleware/authenticate";

export const verificationRouter = Router();

verificationRouter.use(authenticate);

verificationRouter.post("/", requirePermission("VERIFY_INTERNAL"), acceptOptionalFile, createVerification);
