import { apiRequest } from "../../../services/api/client";
import { isPlainRecord, unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import {
  parseProjectLifecycleHistoryEntry,
  parsePublicProject,
  type ProjectLifecycleHistoryEntry,
  type PublicProject,
} from "../types";

export type ProjectCreateInput = {
  name: string;
  contractorId: string;
  description?: string;
  nestTenderReference?: string;
  nestContractReference?: string;
  ocid?: string;
  procuringEntity?: string;
  contractStatus?: string;
  contractStartDate?: string;
  contractEndDate?: string;
};

export async function listProjects(): Promise<PublicProject[]> {
  const payload = await apiRequest<unknown>("/projects");
  const records = unwrapNamedList(payload, "projects");
  if (!records) {
    throw new Error("The project list response is not in a known format.");
  }

  const projects = records
    .map(parsePublicProject)
    .filter((record): record is PublicProject => record !== null);
  if (projects.length !== records.length) {
    throw new Error("The project list response is not in a known format.");
  }
  return projects;
}

export async function getProject(projectId: string): Promise<PublicProject> {
  const payload = await apiRequest<unknown>(`/projects/${projectId}`);
  const record = unwrapNamedRecord(payload, "project");
  const project = record ? parsePublicProject(record) : null;
  if (!project) {
    throw new Error("The project response is not in a known format.");
  }
  return project;
}

export async function createProject(input: ProjectCreateInput): Promise<PublicProject> {
  const payload = await apiRequest<unknown>("/projects", {
    method: "POST",
    body: {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      contractorId: input.contractorId,
      ...(input.nestTenderReference ? { nestTenderReference: input.nestTenderReference } : {}),
      ...(input.nestContractReference ? { nestContractReference: input.nestContractReference } : {}),
      ...(input.ocid ? { ocid: input.ocid } : {}),
      ...(input.procuringEntity ? { procuringEntity: input.procuringEntity } : {}),
      ...(input.contractStatus ? { contractStatus: input.contractStatus } : {}),
      ...(input.contractStartDate ? { contractStartDate: input.contractStartDate } : {}),
      ...(input.contractEndDate ? { contractEndDate: input.contractEndDate } : {}),
    },
  });

  const record = isPlainRecord(payload) && isPlainRecord(payload.data) ? payload.data.project : undefined;
  const project = record ? parsePublicProject(record) : null;
  if (!project) {
    throw new Error("The project creation response is not in a known format.");
  }
  return project;
}

export async function assignProjectContractor(projectId: string, contractorId: string): Promise<PublicProject> {
  const payload = await apiRequest<unknown>(`/projects/${encodeURIComponent(projectId)}/contractor`, {
    method: "PATCH",
    body: { contractorId },
  });
  const record = isPlainRecord(payload) && isPlainRecord(payload.data) ? payload.data.project : undefined;
  const project = record ? parsePublicProject(record) : null;
  if (!project) {
    throw new Error("The contractor assignment response is not in a known format.");
  }
  return project;
}

/**
 * Recorded project lifecycle transitions.
 *
 * Read-only. The server owns every lifecycle decision; this endpoint only
 * reports what was recorded, so the history is never a client-side inference.
 */
export async function listProjectLifecycleHistory(
  projectId: string,
): Promise<ProjectLifecycleHistoryEntry[]> {
  const payload = await apiRequest<unknown>(
    `/projects/${encodeURIComponent(projectId)}/lifecycle-history`,
  );
  const records = unwrapNamedList(payload, "history");
  if (!records) {
    throw new Error("The project lifecycle history response is not in a known format.");
  }

  const entries = records
    .map(parseProjectLifecycleHistoryEntry)
    .filter((entry): entry is ProjectLifecycleHistoryEntry => entry !== null);
  if (entries.length !== records.length) {
    throw new Error("The project lifecycle history response is not in a known format.");
  }
  return entries;
}
