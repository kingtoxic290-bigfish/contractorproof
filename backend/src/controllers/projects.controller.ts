import type { Request, Response, NextFunction } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import {
  assertCanReadMilestone,
  assertCanReadProject,
  projectListWhere,
} from "../services/access.service";
import { projectService } from "../services/project.service";
import { projectLifecycleService } from "../services/projectLifecycle.service";
import { milestoneHistoryService } from "../services/milestoneHistory.service";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

export async function listProjects(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const projects = await projectService.list(projectListWhere(actor));
    res.json({ projects });
  } catch (error) {
    next(error);
  }
}

export async function getProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const project = await projectService.getById(requireUuid(req.params.projectId, "projectId"));
    await assertCanReadProject(actor, project.id);
    res.json({ project });
  } catch (error) {
    next(error);
  }
}

export async function createProject(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const project = await projectService.create(actor, req.body ?? {});
    sendData(res, { project }, 201);
  } catch (error) {
    next(error);
  }
}

export async function assignProjectContractor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const project = await projectService.assignContractor(
      actor,
      requireUuid(req.params.projectId, "projectId"),
      req.body ?? {},
    );
    sendData(res, { project });
  } catch (error) {
    next(error);
  }
}

export async function listProjectLifecycleHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const projectId = requireUuid(req.params.projectId, "projectId");
    const history = await projectLifecycleService.listHistory(actor, projectId);
    sendData(res, { history });
  } catch (error) {
    next(error);
  }
}

export async function transitionProjectLifecycle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const projectId = requireUuid(req.params.projectId, "projectId");
    const result = await projectLifecycleService.transition(actor, projectId, req.body ?? {});
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}

export async function listProjectMilestones(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const project = await projectService.getById(requireUuid(req.params.projectId, "projectId"));
    await assertCanReadProject(actor, project.id);
    const milestones = await projectService.listMilestones(project.id);
    res.json({ milestones });
  } catch (error) {
    next(error);
  }
}

export async function createProjectMilestone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestone = await projectService.createMilestone(actor, {
      ...(req.body ?? {}),
      projectId: requireUuid(req.params.projectId, "projectId"),
    });
    sendData(res, { milestone }, 201);
  } catch (error) {
    next(error);
  }
}

export async function createMilestone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestone = await projectService.createMilestone(actor, req.body ?? {});
    sendData(res, { milestone }, 201);
  } catch (error) {
    next(error);
  }
}

export async function getMilestone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestone = await projectService.getMilestoneById(
      requireUuid(req.params.milestoneId, "milestoneId"),
    );
    await assertCanReadMilestone(actor, milestone.id);
    res.json({ milestone });
  } catch (error) {
    next(error);
  }
}

export async function listMilestoneStatusHistory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = requireUuid(req.params.milestoneId, "milestoneId");
    const history = await milestoneHistoryService.list(actor, milestoneId);
    sendData(res, { history });
  } catch (error) {
    next(error);
  }
}

export async function transitionMilestone(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = requireUuid(req.params.milestoneId, "milestoneId");
    const result = await milestoneHistoryService.transition(actor, milestoneId, req.body ?? {});
    sendData(res, result);
  } catch (error) {
    next(error);
  }
}
