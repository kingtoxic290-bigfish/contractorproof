import { Router } from "express";
import { requirePermission } from "../authz/permissions";
import {
	createMilestone,
	getMilestone,
	listMilestoneStatusHistory,
	transitionMilestone,
} from "../controllers/projects.controller";
import { authenticate } from "../middleware/authenticate";

export const milestonesRouter = Router();

milestonesRouter.use(authenticate);
milestonesRouter.post("/", requirePermission("MILESTONE_WRITE"), createMilestone);
milestonesRouter.get("/:milestoneId/history", listMilestoneStatusHistory);
milestonesRouter.post("/:milestoneId/transitions", transitionMilestone);
milestonesRouter.get("/:milestoneId", getMilestone);
