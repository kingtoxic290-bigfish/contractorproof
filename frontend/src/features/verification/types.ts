import { ApiError, userFacingError } from "../../services/api/errors";
import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";
import type { Role } from "../../types/roles";

/**
 * Roles whose project scope currently supports the internal verification UI.
 * CONSULTANT_ENGINEER passes the backend role gate but has no project membership
 * scope, so this UI keeps that role restricted rather than bypassing ownership.
 */
export const VERIFY_INTERNAL_ROLES: Role[] = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
];

export const VERIFICATION_PAGE_ROLES: Role[] = [...VERIFY_INTERNAL_ROLES, "CLIENT"];

/**
 * Roles that pass the ATTEST gate on POST /api/v1/attestations.
 * The verification UI is separately limited to roles with supported project scope.
 */
export const ATTEST_ROLES: Role[] = [
  "CONSULTANT_ENGINEER",
  "CLIENT",
  "PROCUREMENT_OFFICER",
  "AUDITOR",
  "ADMIN",
];

export const VERIFICATION_STATUSES = ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const ATTESTATION_DECISIONS = ["APPROVED", "REJECTED"] as const;
export type AttestationDecision = (typeof ATTESTATION_DECISIONS)[number];

export type PublicVerification = {
  id: string | null;
  status: VerificationStatus;
  source: "INTERNAL";
  evidenceId: string | null;
  evidenceVersionId: string | null;
  sha256: string | null;
  createdAt: string | null;
  proof: PublicVerificationProof | null;
};

/** Minimal proof metadata returned alongside an internal verification result. */
export type PublicVerificationProof = {
  id: string;
  eventType: string;
  txHash: string | null;
  blockNumber: number | null;
  evidenceHash: string | null;
};

export type PublicAttestation = {
  id: string;
  evidenceId: string;
  milestoneId: string;
  decision: string;
  verifierRole: string;
  comment: string | null;
  createdAt: string;
};

/**
 * HTTP `toHttpVerification` omits the service `meaning` field.
 * These texts are the backend VerificationService meanings, mapped at the
 * domain boundary from `status`. Status values are never rewritten.
 */
export const VERIFICATION_STATUS_MEANING: Record<VerificationStatus, string> = {
  MATCH:
    "The submitted file matches the recorded evidence fingerprint. This does not mean the blockchain independently proves the underlying claim is true.",
  MISMATCH: "The submitted file does not match the recorded evidence fingerprint.",
  PENDING: "Verification cannot be completed because the authoritative fingerprint is not ready.",
  UNAVAILABLE:
    "Verification could not be performed because the authoritative record is unavailable.",
};

export const MISMATCH_EXPLANATION =
  "The submitted file does not match the recorded evidence fingerprint. This is a technical comparison result and does not establish why the bytes differ.";

export type ActionPhase =
  | "ready"
  | "submitting"
  | "recorded"
  | "failed"
  | "unauthorized"
  | "forbidden"
  | "notfound"
  | "conflict"
  | "validation"
  | "unavailable";

export function isVerificationStatus(value: string): value is VerificationStatus {
  return (VERIFICATION_STATUSES as readonly string[]).includes(value);
}

export function isAttestationDecision(value: string): value is AttestationDecision {
  return (ATTESTATION_DECISIONS as readonly string[]).includes(value);
}

export function meaningForVerificationStatus(status: string): string | null {
  return isVerificationStatus(status) ? VERIFICATION_STATUS_MEANING[status] : null;
}

export function parsePublicVerification(value: unknown): PublicVerification | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const status = value.status;
  const id = nullableStringField(value, "id");
  const source = value.source;
  const evidenceId = nullableStringField(value, "evidenceId");
  const evidenceVersionId = nullableStringField(value, "evidenceVersionId");
  const sha256 = nullableStringField(value, "sha256");
  const createdAt = nullableTimestampField(value, "createdAt");
  if (
    typeof status !== "string" ||
    !isVerificationStatus(status) ||
    source !== "INTERNAL" ||
    id === undefined ||
    evidenceId === undefined ||
    evidenceVersionId === undefined ||
    sha256 === undefined ||
    (sha256 !== null && !isSha256(sha256)) ||
    createdAt === undefined
  ) {
    return null;
  }

  return {
    id,
    status,
    source,
    evidenceId,
    evidenceVersionId,
    sha256,
    createdAt,
    proof: null,
  };
}

export function parsePublicVerificationProof(value: unknown): PublicVerificationProof | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const id = asRequiredString(value.id);
  const eventType = value.eventType;
  const txHash = nullableStringField(value, "txHash");
  const evidenceHash = nullableStringField(value, "evidenceHash");
  const blockNumber =
    value.blockNumber === null
      ? null
      : typeof value.blockNumber === "number" && Number.isSafeInteger(value.blockNumber)
        ? value.blockNumber
        : undefined;
  if (
    !id ||
    eventType !== "VERIFICATION" ||
    txHash === undefined ||
    evidenceHash === undefined ||
    blockNumber === undefined ||
    (blockNumber !== null && blockNumber < 0) ||
    (evidenceHash !== null && !isSha256(evidenceHash))
  ) {
    return null;
  }
  return { id, eventType, txHash, blockNumber, evidenceHash };
}

function nullableStringField(record: Record<string, unknown>, key: string): string | null | undefined {
  if (!(key in record)) return undefined;
  const value = record[key];
  return value === null || (typeof value === "string" && value.length > 0) ? value : undefined;
}

function nullableTimestampField(
  record: Record<string, unknown>,
  key: string,
): string | null | undefined {
  const value = nullableStringField(record, key);
  if (value === null || value === undefined) return value;
  return Number.isFinite(Date.parse(value)) ? value : undefined;
}

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}

export function parsePublicAttestation(value: unknown): PublicAttestation | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const evidenceId = asRequiredString(value.evidenceId);
  const milestoneId = asRequiredString(value.milestoneId);
  const decision = asRequiredString(value.decision);
  const verifierRole = asRequiredString(value.verifierRole);
  const createdAt = asRequiredString(value.createdAt);
  if (!id || !evidenceId || !milestoneId || !decision || !verifierRole || !createdAt) {
    return null;
  }

  return {
    id,
    evidenceId,
    milestoneId,
    decision,
    verifierRole,
    comment: asNullableString(value.comment),
    createdAt,
  };
}

export function phaseFromActionError(error: unknown): ActionPhase {
  if (error instanceof ApiError) {
    if (error.status === 400 || error.isUnprocessable) {
      return "validation";
    }
    if (error.isUnauthorized) {
      return "unauthorized";
    }
    if (error.isForbidden) {
      return "forbidden";
    }
    if (error.isNotFound) {
      return "notfound";
    }
    if (error.isConflict) {
      return "conflict";
    }
    if (error.isUnavailable) {
      return "unavailable";
    }
  }
  return "failed";
}

export function verificationActionMessage(error: unknown): string {
  if (error instanceof Error && error.message.includes("not in a known format")) {
    return error.message;
  }
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      return "You need to sign in to verify this evidence.";
    }
    if (error.isForbidden) {
      return error.message || "You do not have permission to verify this evidence.";
    }
    if (error.isNotFound) {
      return "The requested record was not found.";
    }
    if (error.isConflict) {
      return error.message || "This request conflicts with an existing record.";
    }
    if (error.isUnprocessable) {
      return "The server could not accept this information.";
    }
    if (error.isRateLimited) {
      return "Too many requests. Please try again later.";
    }
    if (error.isUnavailable) {
      return "The service is temporarily unavailable.";
    }
    if (error.status === 400) {
      return error.message || "The request was not valid.";
    }
    if (error.status === 500) {
      return "The verification request could not be completed.";
    }
  }
  if (error instanceof TypeError) {
    return "We couldn't reach the server. Please try again.";
  }
  return userFacingError(error, "The verification request could not be completed.");
}

export function attestationActionMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      return "You need to sign in to attest this evidence.";
    }
    if (error.isForbidden) {
      return error.message || "You do not have permission to attest this evidence.";
    }
    if (error.isNotFound) {
      return "The requested record was not found.";
    }
    if (error.isConflict) {
      return error.message || "This verifier has already attested this evidence.";
    }
    if (error.isUnprocessable) {
      return "The server could not accept this information.";
    }
    if (error.isRateLimited) {
      return "Too many requests. Please try again later.";
    }
    if (error.isUnavailable) {
      return "The service is temporarily unavailable.";
    }
    if (error.status === 400) {
      return error.message || "The request was not valid.";
    }
    if (error.status === 500) {
      return "The attestation request could not be completed.";
    }
  }
  if (error instanceof TypeError) {
    return "We couldn't reach the server. Please try again.";
  }
  return userFacingError(error, "The attestation request could not be completed.");
}
