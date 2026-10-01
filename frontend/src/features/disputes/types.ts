import {
  asNullableString,
  asRequiredString,
  isPlainRecord,
} from "../shared/query";
import { parseWorkflowProof, type WorkflowProof } from "../shared/blockchainProof";

/**
 * Dispute states. These are the backend's values and are not extended here.
 * A dispute is appended as its own event and never mutates technical
 * verification or blockchain proof.
 */
export const DISPUTE_STATUSES = ["OPEN", "UNDER_REVIEW", "RESOLVED", "REJECTED"] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** Mirrors the backend DISPUTE_READ permission. */
export const DISPUTE_PAGE_ROLES = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
  "CONTRACTOR",
  "CONSULTANT_ENGINEER",
  "CLIENT",
] as const;

export type PublicDisputeResolution = {
  id: string;
  status: string;
  resolution: string;
  resolvedById: string;
  resolvedByRole: string;
  createdAt: string;
};

export type PublicDispute = {
  id: string;
  milestoneId: string;
  evidenceId: string | null;
  raisedById: string;
  status: DisputeStatus;
  reason: string;
  originalEventId: string;
  createdAt: string;
  updatedAt: string;
  blockchainProof: WorkflowProof | null;
  originalProof: WorkflowProof | null;
  resolutionProof: WorkflowProof | null;
  resolutions: PublicDisputeResolution[];
};

function isDisputeStatus(value: string): value is DisputeStatus {
  return (DISPUTE_STATUSES as readonly string[]).includes(value);
}

function timestamp(value: unknown): string | undefined {
  const text = asRequiredString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function optionalProof(value: unknown): WorkflowProof | null | undefined {
  if (value === null) return null;
  if (!isPlainRecord(value)) return undefined;
  return parseWorkflowProof(value);
}

function parseResolution(value: unknown): PublicDisputeResolution | undefined {
  if (!isPlainRecord(value)) return undefined;
  const id = asRequiredString(value.id);
  const status = asRequiredString(value.status);
  const resolution = asRequiredString(value.resolution);
  const resolvedById = asRequiredString(value.resolvedById);
  const resolvedByRole = asRequiredString(value.resolvedByRole);
  const createdAt = timestamp(value.createdAt);
  if (!id || !status || !resolution || !resolvedById || !resolvedByRole || !createdAt) {
    return undefined;
  }
  return { id, status, resolution, resolvedById, resolvedByRole, createdAt };
}

export function parsePublicDispute(value: unknown): PublicDispute | null {
  if (!isPlainRecord(value)) return null;

  const id = asRequiredString(value.id);
  const milestoneId = asRequiredString(value.milestoneId);
  const raisedById = asRequiredString(value.raisedById);
  const status = asRequiredString(value.status);
  const reason = asRequiredString(value.reason);
  const originalEventId = asRequiredString(value.originalEventId);
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  const evidenceId = asNullableString(value.evidenceId);
  const blockchainProof = optionalProof(value.blockchainProof);
  const originalProof = optionalProof(value.originalProof);
  const resolutionProof = optionalProof(value.resolutionProof);

  if (
    !id ||
    !milestoneId ||
    !raisedById ||
    !status ||
    !isDisputeStatus(status) ||
    !reason ||
    !originalEventId ||
    !createdAt ||
    !updatedAt ||
    evidenceId === undefined ||
    blockchainProof === undefined ||
    originalProof === undefined ||
    resolutionProof === undefined
  ) {
    return null;
  }

  const rawResolutions = value.resolutions;
  if (!Array.isArray(rawResolutions)) return null;
  const resolutions = rawResolutions.map(parseResolution);
  if (resolutions.some((entry) => entry === undefined)) return null;

  return {
    id,
    milestoneId,
    evidenceId,
    raisedById,
    status,
    reason,
    originalEventId,
    createdAt,
    updatedAt,
    blockchainProof,
    originalProof,
    resolutionProof,
    resolutions: resolutions as PublicDisputeResolution[],
  };
}