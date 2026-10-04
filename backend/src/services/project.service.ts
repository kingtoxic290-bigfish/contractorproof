import { Role, type Milestone, type Prisma } from "@prisma/client";
import { ApiError } from "../http/errors";
import { HttpError } from "../middleware/errorHandler";
import { contractorRepository } from "../repositories/contractor.repository";
import { projectRepository, type ProjectWithRelations } from "../repositories/project.repository";
import { RepositoryError } from "../repositories/errors";
import { assertCanManageProject, assertCanWriteProject } from "./access.service";
import type { PublicMilestone, PublicProject, PublicUser } from "../types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireProjectId(projectId: string | undefined): string {
  if (!projectId || !UUID_PATTERN.test(projectId)) {
    throw new HttpError(400, "projectId must be a valid UUID");
  }
  return projectId;
}

function optionalTrimmed(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function optionalDate(value: unknown, field: string): Date | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be an ISO date string`);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} must be an ISO date string`);
  }
  return parsed;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toPublicProject(row: ProjectWithRelations): PublicProject {
  return {
    id: row.id,
    lifecycleStatus: row.lifecycleStatus,
    clientName: row.client?.fullName ?? null,
    contractorId: row.contractorId,
    contractorName: row.contractor.legalName,
    contractorCrbRegistrationNumber: row.contractor.crbRegistrationNumber,
    name: row.name,
    description: row.description,
    nestTenderReference: row.nestTenderReference,
    nestContractReference: row.nestContractReference,
    ocid: row.ocid,
    procuringEntity: row.procuringEntity,
    contractStatus: row.contractStatus,
    contractStartDate: toIsoString(row.contractStartDate),
    contractEndDate: toIsoString(row.contractEndDate),
    nestSource: row.nestSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPublicMilestone(row: Milestone): PublicMilestone {
  return {
    id: row.id,
    projectId: row.projectId,
    policyId: row.policyId,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export const projectService = {
  async list(where?: Prisma.ProjectWhereInput): Promise<PublicProject[]> {
    const rows = where
      ? await projectRepository.findAccessible(where)
      : await projectRepository.listProjects();
    return rows.map(toPublicProject);
  },

  async getById(projectId: string | undefined): Promise<PublicProject> {
    const id = requireProjectId(projectId);
    const row = await projectRepository.getProjectById(id);
    if (!row) {
      throw new HttpError(404, "project not found");
    }
    return toPublicProject(row);
  },

  async listMilestones(projectId: string | undefined): Promise<PublicMilestone[]> {
    const id = requireProjectId(projectId);
    const project = await projectRepository.getProjectById(id);
    if (!project) {
      throw new HttpError(404, "project not found");
    }

    const rows = await projectRepository.listProjectMilestones(id);
    return rows.map(toPublicMilestone);
  },

  async getMilestoneById(milestoneId: string | undefined): Promise<PublicMilestone> {
    if (!milestoneId || !UUID_PATTERN.test(milestoneId)) {
      throw new HttpError(400, "milestoneId must be a valid UUID");
    }
    const row = await projectRepository.getMilestoneById(milestoneId);
    if (!row) {
      throw new HttpError(404, "milestone not found");
    }
    return toPublicMilestone(row);
  },

  async create(
    actor: PublicUser,
    input: {
      name?: unknown;
      description?: unknown;
      contractorId?: unknown;
      nestTenderReference?: unknown;
      nestContractReference?: unknown;
      ocid?: unknown;
      procuringEntity?: unknown;
      contractStatus?: unknown;
      contractStartDate?: unknown;
      contractEndDate?: unknown;
    },
  ): Promise<PublicProject> {
    const name = optionalTrimmed(input.name);
    if (!name) {
      throw new ApiError(400, "VALIDATION_ERROR", "name is required");
    }

    if (actor.role !== Role.CLIENT && actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    }
    const suppliedContractorId = optionalTrimmed(input.contractorId);
    if (!suppliedContractorId || !UUID_PATTERN.test(suppliedContractorId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "contractorId must be a valid UUID");
    }
    const contractor = await contractorRepository.getContractorById(suppliedContractorId);
    if (!contractor || contractor.user.role !== Role.CONTRACTOR) {
      throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    }

    const row = await projectRepository.createProject({
      clientId: actor.role === Role.CLIENT ? actor.id : null,
      contractorId: contractor.id,
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      name,
      description: optionalTrimmed(input.description) ?? null,
      nestTenderReference: optionalTrimmed(input.nestTenderReference) ?? null,
      nestContractReference: optionalTrimmed(input.nestContractReference) ?? null,
      ocid: optionalTrimmed(input.ocid) ?? null,
      procuringEntity: optionalTrimmed(input.procuringEntity) ?? null,
      contractStatus: optionalTrimmed(input.contractStatus) ?? null,
      contractStartDate: optionalDate(input.contractStartDate, "contractStartDate") ?? null,
      contractEndDate: optionalDate(input.contractEndDate, "contractEndDate") ?? null,
    });
    return toPublicProject(row);
  },

  async createMilestone(
    actor: PublicUser,
    input: {
      projectId?: unknown;
      name?: unknown;
      description?: unknown;
      policyId?: unknown;
    },
  ): Promise<PublicMilestone> {
    const projectId = optionalTrimmed(input.projectId);
    if (!projectId || !UUID_PATTERN.test(projectId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "projectId must be a valid UUID");
    }
    const name = optionalTrimmed(input.name);
    if (!name) {
      throw new ApiError(400, "VALIDATION_ERROR", "name is required");
    }

    await assertCanManageProject(actor, projectId);

    const policyId = optionalTrimmed(input.policyId);
    if (policyId) {
      if (!UUID_PATTERN.test(policyId)) {
        throw new ApiError(400, "VALIDATION_ERROR", "policyId must be a valid UUID");
      }
      const policy = await projectRepository.getPolicyById(policyId);
      if (!policy) {
        throw new ApiError(404, "POLICY_NOT_FOUND", "verification policy not found");
      }
      if (policy.projectId && policy.projectId !== projectId) {
        throw new ApiError(400, "VALIDATION_ERROR", "policy does not belong to project");
      }
    }

    let row: Milestone;
    try {
      row = await projectRepository.createMilestone({
        projectId,
        name,
        actorId: actor.id,
        actorName: actor.fullName,
        actorRole: actor.role,
        description: optionalTrimmed(input.description) ?? null,
        policyId: policyId ?? null,
      });
    } catch (error) {
      if (error instanceof RepositoryError && error.message === "milestones cannot be added after project execution starts") {
        throw new ApiError(409, "CONFLICT", error.message);
      }
      throw error;
    }
    return toPublicMilestone(row);
  },

  async assignContractor(
    actor: PublicUser,
    projectId: string | undefined,
    input: { contractorId?: unknown },
  ): Promise<PublicProject> {
    const id = requireProjectId(projectId);
    await assertCanManageProject(actor, id);
    const contractorId = optionalTrimmed(input.contractorId);
    if (!contractorId || !UUID_PATTERN.test(contractorId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "contractorId must be a valid UUID");
    }
    const contractor = await contractorRepository.getContractorById(contractorId);
    if (!contractor || contractor.user.role !== Role.CONTRACTOR) {
      throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    }
    const updated = await projectRepository.updateProjectContractor(id, contractor.id);
    return toPublicProject(updated);
  },
};
