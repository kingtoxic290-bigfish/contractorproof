import type { Milestone, Prisma, Project, VerificationPolicy } from "@prisma/client";
import { prisma } from "./prisma";

export type CreateProjectInput = {
  contractorId: string;
  name: string;
  description?: string | null;
  nestTenderReference?: string | null;
  nestContractReference?: string | null;
  ocid?: string | null;
  procuringEntity?: string | null;
  contractStatus?: string | null;
  contractStartDate?: Date | null;
  contractEndDate?: Date | null;
};

export type CreateMilestoneInput = {
  projectId: string;
  name: string;
  description?: string | null;
  policyId?: string | null;
};

export const projectRepository = {
  listProjects(): Promise<Project[]> {
    return prisma.project.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  findAccessible(where: Prisma.ProjectWhereInput): Promise<Project[]> {
    return prisma.project.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  getProjectById(id: string): Promise<Project | null> {
    return prisma.project.findUnique({
      where: { id },
    });
  },

  createProject(input: CreateProjectInput): Promise<Project> {
    return prisma.project.create({
      data: {
        contractorId: input.contractorId,
        name: input.name,
        description: input.description ?? null,
        nestTenderReference: input.nestTenderReference ?? null,
        nestContractReference: input.nestContractReference ?? null,
        ocid: input.ocid ?? null,
        procuringEntity: input.procuringEntity ?? null,
        contractStatus: input.contractStatus ?? null,
        contractStartDate: input.contractStartDate ?? null,
        contractEndDate: input.contractEndDate ?? null,
      },
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

  getPolicyById(id: string): Promise<VerificationPolicy | null> {
    return prisma.verificationPolicy.findUnique({
      where: { id },
    });
  },

  createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
    return prisma.milestone.create({
      data: {
        projectId: input.projectId,
        name: input.name,
        description: input.description ?? null,
        policyId: input.policyId ?? null,
      },
    });
  },
};
