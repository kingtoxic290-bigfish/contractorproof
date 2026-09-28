import { asRequiredString, isPlainRecord } from "../shared/query";

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

export type PersistedVerificationStatus = "MATCH" | "MISMATCH" | "PENDING" | "UNAVAILABLE";
export type EvidenceWorkflowStatus = "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED";

export type PublicEvidence = {
  id: string;
  milestoneId: string;
  currentVersionId: string | null;
  fileName: string;
  sha256: string;
  mimeType: string;
  sizeBytes: number;
  status: EvidenceWorkflowStatus;
  verificationStatus: PersistedVerificationStatus;
  currentVersion: PublicEvidenceVersion | null;
  createdAt: string;
  updatedAt: string;
};

function asRequiredNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function asTimestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function isVerificationStatus(value: unknown): value is PersistedVerificationStatus {
  return value === "MATCH" || value === "MISMATCH" || value === "PENDING" || value === "UNAVAILABLE";
}

function isEvidenceWorkflowStatus(value: unknown): value is EvidenceWorkflowStatus {
  return value === "PENDING_VERIFICATION" || value === "VERIFIED" || value === "REJECTED";
}

export function parsePublicEvidenceVersion(value: unknown): PublicEvidenceVersion | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const evidenceId = asRequiredString(value.evidenceId);
  const sha256 = value.sha256;
  const fileName = asRequiredString(value.fileName);
  const mimeType = asRequiredString(value.mimeType);
  const createdAt = asTimestamp(value.createdAt);
  const versionNumber = asRequiredNumber(value.versionNumber);
  const sizeBytes = asRequiredNumber(value.sizeBytes);
  if (
    !id ||
    !evidenceId ||
    !isSha256(sha256) ||
    !fileName ||
    !mimeType ||
    !createdAt ||
    versionNumber === null ||
    sizeBytes === null ||
    versionNumber < 1
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
  if (!("currentVersion" in value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const milestoneId = asRequiredString(value.milestoneId);
  const fileName = asRequiredString(value.fileName);
  const sha256 = value.sha256;
  const mimeType = asRequiredString(value.mimeType);
  const status = value.status;
  const verificationStatus = value.verificationStatus;
  const createdAt = asTimestamp(value.createdAt);
  const updatedAt = asTimestamp(value.updatedAt);
  const sizeBytes = asRequiredNumber(value.sizeBytes);
  const currentVersionId =
    value.currentVersionId === null || typeof value.currentVersionId === "string"
      ? value.currentVersionId
      : undefined;
  if (
    !id ||
    !milestoneId ||
    !fileName ||
    !isSha256(sha256) ||
    !mimeType ||
    !isEvidenceWorkflowStatus(status) ||
    !isVerificationStatus(verificationStatus) ||
    !createdAt ||
    !updatedAt ||
    sizeBytes === null ||
    currentVersionId === undefined
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
  if (
    currentVersion &&
    (currentVersion.id !== currentVersionId ||
      currentVersion.evidenceId !== id ||
      currentVersion.sha256 !== sha256)
  ) {
    return null;
  }

  return {
    id,
    milestoneId,
    currentVersionId,
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
  | "notfound"
  | "conflict"
  | "unavailable";
