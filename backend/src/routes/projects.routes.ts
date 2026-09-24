import { Router } from "express";
import {
  getProject,
  listProjectMilestones,
  listProjects,
} from "../controllers/projects.controller";
import { authenticate } from "../middleware/authenticate";

export const projectsRouter = Router();

// Stage 2 project/milestone GETs remain authenticate-only (grandfathered).
projectsRouter.use(authenticate);
projectsRouter.get("/", listProjects);
projectsRouter.get("/:projectId/milestones", listProjectMilestones);
projectsRouter.get("/:projectId", getProject);
