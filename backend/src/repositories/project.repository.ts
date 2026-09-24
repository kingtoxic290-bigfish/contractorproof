import type { Milestone, Project } from "@prisma/client";
import { prisma } from "./prisma";

export const projectRepository = {
  listProjects(): Promise<Project[]> {
    return prisma.project.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  getProjectById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id },
    });
  },

  listProjectMilestones(projectId: string): Promise<Milestone[]> {
    return prisma.milestone.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  },

  getMilestoneById(id: string): Promise<Milestone | null> {
    return prisma.milestone.findUnique({
      where: { id },
    });
  },
};
