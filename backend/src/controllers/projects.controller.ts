import type { Request, Response, NextFunction } from "express";
import { projectService } from "../services/project.service";

export async function listProjects(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const projects = await projectService.list();
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
    const project = await projectService.getById(req.params.projectId);
    res.json({ project });
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
    const milestones = await projectService.listMilestones(req.params.projectId);
    res.json({ milestones });
  } catch (error) {
    next(error);
  }
}
