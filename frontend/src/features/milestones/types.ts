import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export type PublicMilestone = {
  id: string;
  projectId: string;
  policyId: string | null;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function parsePublicMilestone(value: unknown): PublicMilestone | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const projectId = asRequiredString(value.projectId);
  const name = asRequiredString(value.name);
  const status = asRequiredString(value.status);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  if (!id || !projectId || !name || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    projectId,
    policyId: asNullableString(value.policyId),
    name,
    description: asNullableString(value.description),
    status,
    createdAt,
    updatedAt,
  };
}

/** Milestone statuses are the Prisma MilestoneStatus values, unchanged. */
export const MILESTONE_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "PENDING_VERIFICATION",
  "VERIFIED",
  "REJECTED",
] as const;

export type MilestoneStatusValue = (typeof MILESTONE_STATUSES)[number];

/**
 * One recorded milestone status transition, exactly as the backend stored it.
 *
 * `previousStatus` is null for the baseline entry written when the milestone was
 * created. `reason` and `actorName` are recorded by the workflow when it
 * supplied them and are null otherwise — never inferred, never summarised. This
 * is a factual audit trail, not a score.
 */
export type MilestoneStatusHistoryEntry = {
  id: string;
  milestoneId: string;
  previousStatus: string | null;
  newStatus: string;
  actorName: string | null;
  actorRole: string | null;
  evidenceId: string | null;
  isBaseline: boolean;
  reason: string | null;
  createdAt: string;
};

export function parseMilestoneStatusHistoryEntry(value: unknown): MilestoneStatusHistoryEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const milestoneId = asRequiredString(value.milestoneId);
  const newStatus = asRequiredString(value.newStatus);
  const createdAt = asRequiredString(value.createdAt);
  if (!id || !milestoneId || !newStatus || !createdAt) {
    return null;
  }

  // The baseline entry is a recorded fact, not an inference, so a non-boolean
  // value is rejected rather than coerced.
  const isBaseline = value.isBaseline;
  if (typeof isBaseline !== "boolean") {
    return null;
  }

  return {
    id,
    milestoneId,
    previousStatus: asNullableString(value.previousStatus),
    newStatus,
    actorName: asNullableString(value.actorName),
    actorRole: asNullableString(value.actorRole),
    evidenceId: asNullableString(value.evidenceId),
    isBaseline,
    reason: asNullableString(value.reason),
    createdAt,
  };
}
