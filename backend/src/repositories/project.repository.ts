import type { Milestone, Prisma, ProjectLifecycleStatus, Role, VerificationPolicy } from "@prisma/client";
import { prisma } from "./prisma";
import { RepositoryError } from "./errors";

const projectPublicInclude = {
  client: { select: { id: true, fullName: true } },
  // crbRegistrationNumber is the discovery identity a CLIENT already sees on
  // the contractor list and passport, so projecting it here exposes nothing new.
  contractor: { select: { id: true, legalName: true, crbRegistrationNumber: true } },
} satisfies Prisma.ProjectInclude;

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof projectPublicInclude;
}>;

export type CreateProjectInput = {
  clientId?: string | null;
  contractorId: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
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
  actorId: string;
  actorName: string;
  actorRole: Role;
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
    return prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
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
      });
      await tx.projectStatusHistory.create({
        data: {
          projectId: project.id,
          sequence: 0,
          previousStatus: null,
          newStatus: project.lifecycleStatus,
          actorId: input.actorId,
          actorName: input.actorName,
          actorRole: input.actorRole,
          isBaseline: true,
          createdAt: project.createdAt,
        },
      });
      return tx.project.findUniqueOrThrow({
        where: { id: project.id },
        include: projectPublicInclude,
      });
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

  listMilestoneStatusHistory(milestoneId: string) {
    return prisma.milestoneStatusHistory.findMany({
      where: { milestoneId },
      orderBy: [{ sequence: "asc" }],
    });
  },

  getPolicyById(id: string): Promise<VerificationPolicy | null> {
    return prisma.verificationPolicy.findUnique({
      where: { id },
    });
  },

  createMilestone(input: CreateMilestoneInput): Promise<Milestone> {
    return prisma.$transaction(async (tx) => {
      const lockedProject = await tx.$queryRaw<Array<{ lifecycleStatus: ProjectLifecycleStatus }>>`
        SELECT "lifecycleStatus" FROM "Project" WHERE "id" = ${input.projectId} FOR UPDATE
      `;
      if (lockedProject.length === 0) {
        throw new RepositoryError("project not found");
      }
      if (lockedProject[0].lifecycleStatus !== "CREATED") {
        throw new RepositoryError("milestones cannot be added after project execution starts");
      }
      const milestone = await tx.milestone.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description ?? null,
          policyId: input.policyId ?? null,
        },
      });
      await tx.milestoneStatusHistory.create({
        data: {
          milestoneId: milestone.id,
          sequence: 0,
          previousStatus: null,
          newStatus: milestone.status,
          actorId: input.actorId,
          actorName: input.actorName,
          actorRole: input.actorRole,
          isBaseline: true,
          createdAt: milestone.createdAt,
        },
      });
      return milestone;
    });
  },
};
