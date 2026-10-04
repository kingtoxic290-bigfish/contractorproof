import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import {
  assignProjectContractor,
  createProject,
  createProjectMilestone,
  getProject,
  listProjectLifecycleHistory,
  listProjectMilestones,
  listProjects,
  transitionProjectLifecycle,
} from "../controllers/projects.controller";
import { authenticate } from "../middleware/authenticate";

export const projectsRouter = Router();

projectsRouter.use(authenticate);
projectsRouter.post("/", requirePermission("PROJECT_WRITE"), createProject);
projectsRouter.get("/", listProjects);
projectsRouter.patch("/:projectId/contractor", requirePermission("PROJECT_WRITE"), assignProjectContractor);
projectsRouter.get("/:projectId/lifecycle-history", listProjectLifecycleHistory);
projectsRouter.post("/:projectId/lifecycle-transitions", transitionProjectLifecycle);
projectsRouter.post(
  "/:projectId/milestones",
  requirePermission("MILESTONE_WRITE"),
  createProjectMilestone,
);
projectsRouter.get("/:projectId/milestones", listProjectMilestones);
projectsRouter.get("/:projectId", getProject);
