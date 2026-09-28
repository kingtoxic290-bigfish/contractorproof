import { apiRequest } from "../../../services/api/client";
import { isPlainRecord, unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import { parsePublicMilestone, type PublicMilestone } from "../types";

export type MilestoneCreateInput = {
  name: string;
  description?: string;
  policyId?: string;
};

export async function listProjectMilestones(projectId: string): Promise<PublicMilestone[]> {
  const payload = await apiRequest<unknown>(`/projects/${encodeURIComponent(projectId)}/milestones`);
  const records = unwrapNamedList(payload, "milestones");
  if (!records) {
    throw new Error("The milestone list response is not in a known format.");
  }

  const milestones = records
    .map(parsePublicMilestone)
    .filter((record): record is PublicMilestone => record !== null);
  if (milestones.length !== records.length) {
    throw new Error("The milestone list response is not in a known format.");
  }
  return milestones;
}

export const listMilestones = listProjectMilestones;

export async function getMilestone(milestoneId: string): Promise<PublicMilestone> {
  const payload = await apiRequest<unknown>(`/milestones/${encodeURIComponent(milestoneId)}`);
  const record = unwrapNamedRecord(payload, "milestone");
  const milestone = record ? parsePublicMilestone(record) : null;
  if (!milestone) {
    throw new Error("The milestone response is not in a known format.");
  }
  return milestone;
}

export async function createMilestone(
  projectId: string,
  input: MilestoneCreateInput,
): Promise<PublicMilestone> {
  const payload = await apiRequest<unknown>(`/projects/${encodeURIComponent(projectId)}/milestones`, {
    method: "POST",
    body: {
      name: input.name,
      ...(input.description ? { description: input.description } : {}),
      ...(input.policyId ? { policyId: input.policyId } : {}),
    },
  });

  const record =
    (isPlainRecord(payload) && isPlainRecord(payload.data) ? payload.data.milestone : undefined) ??
    unwrapNamedRecord(payload, "milestone");
  const milestone = record ? parsePublicMilestone(record) : null;
  if (!milestone) {
    throw new Error("The milestone creation response is not in a known format.");
  }
  return milestone;
}
