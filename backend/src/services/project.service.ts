import type { Milestone, Project } from "@prisma/client";
import { HttpError } from "../middleware/errorHandler";
import { projectRepository } from "../repositories/project.repository";
import type { PublicMilestone, PublicProject } from "../types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function requireProjectId(projectId: string | undefined): string {
  if (!projectId || !UUID_PATTERN.test(projectId)) {
    throw new HttpError(400, "projectId must be a valid UUID");
  }
  return projectId;
}

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toPublicProject(row: Project): PublicProject {
  return {
    id: row.id,
    contractorId: row.contractorId,
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
  async list(): Promise<PublicProject[]> {
    const rows = await projectRepository.listProjects();
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
};
