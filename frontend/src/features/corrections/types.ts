import {
  asNullableString,
  asRequiredString,
  isPlainRecord,
} from "../shared/query";
import { parseWorkflowProof, type WorkflowProof } from "../shared/blockchainProof";

/**
 * Correction states. These are the backend's values and are never renamed or
 * extended here. A correction appends a new event; it never edits the original.
 */
export const CORRECTION_STATUSES = ["OPEN", "UNDER_REVIEW", "APPROVED", "REJECTED"] as const;
export type CorrectionStatus = (typeof CORRECTION_STATUSES)[number];

/** Mirrors the backend CORRECTION_READ permission. */
export const CORRECTION_PAGE_ROLES = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
  "CONTRACTOR",
  "CONSULTANT_ENGINEER",
  "CLIENT",
] as const;

export type PublicEvidenceVersionRef = {
  id: string;
  evidenceId: string;
  versionNumber: number;
  sha256: string;
  createdAt: string;
};

export type PublicCorrectedEvidence = {
  id: string;
  currentVersionId: string | null;
  versions: PublicEvidenceVersionRef[];
};

export type PublicCorrectionResolution = {
  id: string;
  status: string;
  resolution: string;
  correctedEvidenceVersion: PublicEvidenceVersionRef | null;
  resolvedById: string;
  resolvedByRole: string;
  createdAt: string;
};

export type PublicCorrection = {
  id: string;
  milestoneId: string;
  originalEventId: string;
  originalProof: WorkflowProof | null;
  originalEvidenceVersion: PublicEvidenceVersionRef | null;
  evidenceId: string | null;
  correctedEvidence: PublicCorrectedEvidence | null;
  actorId: string;
  reason: string;
  status: CorrectionStatus;
  blockchainProof: WorkflowProof | null;
  resolutions: PublicCorrectionResolution[];
  createdAt: string;
};

function isCorrectionStatus(value: string): value is CorrectionStatus {
  return (CORRECTION_STATUSES as readonly string[]).includes(value);
}

function timestamp(value: unknown): string | undefined {
  const text = asRequiredString(value);
  return text && !Number.isNaN(Date.parse(text)) ? text : undefined;
}

function parseVersionRef(value: unknown): PublicEvidenceVersionRef | undefined {
  if (!isPlainRecord(value)) return undefined;
  const id = asRequiredString(value.id);
  const evidenceId = asRequiredString(value.evidenceId);
  const sha256 = asRequiredString(value.sha256);
  const createdAt = timestamp(value.createdAt);
  const versionNumber = value.versionNumber;
  if (
    !id ||
    !evidenceId ||
    !sha256 ||
    !createdAt ||
    typeof versionNumber !== "number" ||
    !Number.isSafeInteger(versionNumber)
  ) {
    return undefined;
  }
  return { id, evidenceId, versionNumber, sha256, createdAt };
}

function optionalVersionRef(value: unknown): PublicEvidenceVersionRef | null | undefined {
  if (value === null) return null;
  const parsed = parseVersionRef(value);
  return parsed === undefined ? undefined : parsed;
}

function optionalProof(value: unknown): WorkflowProof | null | undefined {
  if (value === null) return null;
  if (!isPlainRecord(value)) return undefined;
  return parseWorkflowProof(value);
}

function parseResolution(value: unknown): PublicCorrectionResolution | undefined {
  if (!isPlainRecord(value)) return undefined;
  const id = asRequiredString(value.id);
  const status = asRequiredString(value.status);
  const resolution = asRequiredString(value.resolution);
  const resolvedById = asRequiredString(value.resolvedById);
  const resolvedByRole = asRequiredString(value.resolvedByRole);
  const createdAt = timestamp(value.createdAt);
  const correctedEvidenceVersion = optionalVersionRef(value.correctedEvidenceVersion);
  if (
    !id ||
    !status ||
    !resolution ||
    !resolvedById ||
    !resolvedByRole ||
    !createdAt ||
    correctedEvidenceVersion === undefined
  ) {
    return undefined;
  }
  return {
    id,
    status,
    resolution,
    correctedEvidenceVersion,
    resolvedById,
    resolvedByRole,
    createdAt,
  };
}

function parseCorrectedEvidence(value: unknown): PublicCorrectedEvidence | null | undefined {
  if (value === null) return null;
  if (!isPlainRecord(value)) return undefined;
  const id = asRequiredString(value.id);
  const currentVersionId = asNullableString(value.currentVersionId);
  if (!id || currentVersionId === undefined) return undefined;
  const rawVersions = value.versions;
  if (!Array.isArray(rawVersions)) return undefined;
  const versions = rawVersions.map(parseVersionRef);
  if (versions.some((entry) => entry === undefined)) return undefined;
  return { id, currentVersionId, versions: versions as PublicEvidenceVersionRef[] };
}

export function parsePublicCorrection(value: unknown): PublicCorrection | null {
  if (!isPlainRecord(value)) return null;

  const id = asRequiredString(value.id);
  const milestoneId = asRequiredString(value.milestoneId);
  const originalEventId = asRequiredString(value.originalEventId);
  const actorId = asRequiredString(value.actorId);
  const reason = asRequiredString(value.reason);
  const status = asRequiredString(value.status);
  const createdAt = timestamp(value.createdAt);
  const evidenceId = asNullableString(value.evidenceId);
  const originalProof = optionalProof(value.originalProof);
  const originalEvidenceVersion = optionalVersionRef(value.originalEvidenceVersion);
  const correctedEvidence = parseCorrectedEvidence(value.correctedEvidence);
  const blockchainProof = optionalProof(value.blockchainProof);

  if (
    !id ||
    !milestoneId ||
    !originalEventId ||
    !actorId ||
    !reason ||
    !status ||
    !isCorrectionStatus(status) ||
    !createdAt ||
    evidenceId === undefined ||
    originalProof === undefined ||
    originalEvidenceVersion === undefined ||
    correctedEvidence === undefined ||
    blockchainProof === undefined
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
    originalEventId,
    originalProof,
    originalEvidenceVersion,
    evidenceId,
    correctedEvidence,
    actorId,
    reason,
    status,
    blockchainProof,
    resolutions: resolutions as PublicCorrectionResolution[],
    createdAt,
  };
}