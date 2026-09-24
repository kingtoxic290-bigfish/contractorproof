import { Router } from "express";
import { createPrivilegedUser } from "../controllers/users.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";

export const usersRouter = Router();

usersRouter.use(authenticate);
usersRouter.post("/", requirePermission("PROVISION_USERS"), createPrivilegedUser);
