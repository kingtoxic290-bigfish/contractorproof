import { apiRequest } from "../../../services/api/client";
import { isPlainRecord, unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import { parsePublicMilestone, type PublicMilestone } from "../types";
import {
  parseMilestoneStatusHistoryEntry,
  type MilestoneStatusHistoryEntry,
} from "../types";

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

/**
 * Append-only milestone status history, oldest first.
 *
 * This is the record of how a milestone reached its current status. It is not a
 * progress percentage and not a judgement about the contractor.
 */
export async function listMilestoneHistory(
  milestoneId: string,
): Promise<MilestoneStatusHistoryEntry[]> {
  const payload = await apiRequest<unknown>(
    `/milestones/${encodeURIComponent(milestoneId)}/history`,
  );
  const records = unwrapNamedList(payload, "history");
  if (!records) {
    throw new Error("The milestone history response is not in a known format.");
  }

  const history = records
    .map(parseMilestoneStatusHistoryEntry)
    .filter((record): record is MilestoneStatusHistoryEntry => record !== null);
  if (history.length !== records.length) {
    throw new Error("The milestone history response is not in a known format.");
  }
  return history;
}

export type MilestoneTransitionInput = {
  status: string;
  evidenceId?: string;
  reason?: string;
};

/**
 * Record one milestone status transition.
 *
 * The server decides which transitions are legal and who may make them: a
 * CONTRACTOR may submit progress but is never allowed to approve, and the
 * approval step additionally requires the attestations its verification policy
 * demands. The UI never assumes a transition is permitted.
 */
export async function transitionMilestone(
  milestoneId: string,
  input: MilestoneTransitionInput,
): Promise<{ milestone: PublicMilestone; historyEntry: MilestoneStatusHistoryEntry }> {
  const payload = await apiRequest<unknown>(
    `/milestones/${encodeURIComponent(milestoneId)}/transitions`,
    {
      method: "POST",
      body: {
        status: input.status,
        ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
        ...(input.reason ? { reason: input.reason } : {}),
      },
    },
  );

  const data = isPlainRecord(payload) && isPlainRecord(payload.data) ? payload.data : null;
  const milestone = data ? parsePublicMilestone(data.milestone) : null;
  const historyEntry = data ? parseMilestoneStatusHistoryEntry(data.historyEntry) : null;
  if (!milestone || !historyEntry) {
    throw new Error("The milestone transition response is not in a known format.");
  }
  return { milestone, historyEntry };
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
