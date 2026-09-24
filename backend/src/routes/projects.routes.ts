import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import {
  createProject,
  createProjectMilestone,
  getProject,
  listProjectMilestones,
  listProjects,
} from "../controllers/projects.controller";
import { authenticate } from "../middleware/authenticate";

export const projectsRouter = Router();

projectsRouter.use(authenticate);
projectsRouter.post("/", requirePermission("PROJECT_WRITE"), createProject);
projectsRouter.get("/", listProjects);
projectsRouter.post(
  "/:projectId/milestones",
  requirePermission("MILESTONE_WRITE"),
  createProjectMilestone,
);
projectsRouter.get("/:projectId/milestones", listProjectMilestones);
projectsRouter.get("/:projectId", getProject);
