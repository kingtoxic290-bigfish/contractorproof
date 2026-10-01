import type { Milestone, Prisma, VerificationPolicy } from "@prisma/client";
import { prisma } from "./prisma";

const projectPublicInclude = {
  client: { select: { id: true, fullName: true } },
  contractor: { select: { id: true, legalName: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof projectPublicInclude;
}>;

export type CreateProjectInput = {
  clientId?: string | null;
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
  listProjects(): Promise<ProjectWithRelations[]> {
    return prisma.project.findMany({
      include: projectPublicInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  findAccessible(where: Prisma.ProjectWhereInput): Promise<ProjectWithRelations[]> {
    return prisma.project.findMany({
      where,
      include: projectPublicInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  getProjectById(id: string): Promise<ProjectWithRelations | null> {
    return prisma.project.findUnique({
      where: { id },
      include: projectPublicInclude,
    });
  },

  hasClientProjectForContractor(clientId: string, contractorId: string): Promise<boolean> {
    return prisma.project.findFirst({
      where: { clientId, contractorId },
      select: { id: true },
    }).then(Boolean);
  },

  createProject(input: CreateProjectInput): Promise<ProjectWithRelations> {
    return prisma.project.create({
      data: {
        clientId: input.clientId ?? null,
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
      include: projectPublicInclude,
    });
  },

  updateProjectContractor(projectId: string, contractorId: string): Promise<ProjectWithRelations> {
    return prisma.project.update({
      where: { id: projectId },
      data: { contractorId },
      include: projectPublicInclude,
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
