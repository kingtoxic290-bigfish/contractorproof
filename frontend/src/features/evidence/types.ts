import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export type PublicEvidenceVersion = {
  id: string;
  evidenceId: string;
  versionNumber: number;
  sha256: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export type PublicEvidence = {
  id: string;
  milestoneId: string;
  currentVersionId: string | null;
  fileName: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  verificationStatus: string;
  currentVersion: PublicEvidenceVersion | null;
  createdAt: string;
  updatedAt: string;
};

function asRequiredNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function parsePublicEvidenceVersion(value: unknown): PublicEvidenceVersion | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const evidenceId = asRequiredString(value.evidenceId);
  const sha256 = asRequiredString(value.sha256);
  const fileName = asRequiredString(value.fileName);
  const mimeType = asRequiredString(value.mimeType);
  const createdAt = asRequiredString(value.createdAt);
  const versionNumber = asRequiredNumber(value.versionNumber);
  const sizeBytes = asRequiredNumber(value.sizeBytes);
  if (
    !id ||
    !evidenceId ||
    !sha256 ||
    !fileName ||
    !mimeType ||
    !createdAt ||
    versionNumber === null ||
    sizeBytes === null
  ) {
    return null;
  }

  return {
    id,
    evidenceId,
    versionNumber,
    sha256,
    fileName,
    mimeType,
    sizeBytes,
    createdAt,
  };
}

export function parsePublicEvidence(value: unknown): PublicEvidence | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const milestoneId = asRequiredString(value.milestoneId);
  const fileName = asRequiredString(value.fileName);
  const sha256 = asRequiredString(value.sha256);
  const mimeType = asRequiredString(value.mimeType);
  const status = asRequiredString(value.status);
  const verificationStatus = asRequiredString(value.verificationStatus);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  const sizeBytes = asRequiredNumber(value.sizeBytes);
  if (
    !id ||
    !milestoneId ||
    !fileName ||
    !sha256 ||
    !mimeType ||
    !status ||
    !verificationStatus ||
    !createdAt ||
    !updatedAt ||
    sizeBytes === null
  ) {
    return null;
  }

  const currentVersion =
    value.currentVersion === null || value.currentVersion === undefined
      ? null
      : parsePublicEvidenceVersion(value.currentVersion);
  if (value.currentVersion != null && !currentVersion) {
    return null;
  }

  return {
    id,
    milestoneId,
    currentVersionId: asNullableString(value.currentVersionId),
    fileName,
    sha256,
    mimeType,
    sizeBytes,
    status,
    verificationStatus,
    currentVersion,
    createdAt,
    updatedAt,
  };
}

export type EvidenceUploadPhase =
  | "ready"
  | "uploading"
  | "uploaded"
  | "failed"
  | "unsupported"
  | "too_large"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "unavailable";
