import { ApiError, userFacingError } from "../../services/api/errors";
import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";
import type { Role } from "../../types/roles";

/**
 * Roles that pass the VERIFY_INTERNAL gate on POST /api/v1/verification.
 * CONTRACTOR is never included. The API remains authoritative.
 */
export const VERIFY_INTERNAL_ROLES: Role[] = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
  "CONSULTANT_ENGINEER",
  "CLIENT",
];

/**
 * Roles that pass the ATTEST gate on POST /api/v1/attestations.
 * Same set as VERIFY_INTERNAL. CONTRACTOR is never included.
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
  status: string;
  source: string;
  evidenceId: string | null;
  evidenceVersionId: string | null;
  sha256: string | null;
  createdAt: string | null;
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
  "The evidence fingerprint does not match the expected integrity record. This is an integrity mismatch, not a determination of why the bytes differ.";

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

  const status = asRequiredString(value.status);
  const source = asRequiredString(value.source);
  if (!status || !source) {
    return null;
  }

  return {
    id: asNullableString(value.id),
    status,
    source,
    evidenceId: asNullableString(value.evidenceId),
    evidenceVersionId: asNullableString(value.evidenceVersionId),
    sha256: asNullableString(value.sha256),
    createdAt: asNullableString(value.createdAt),
  };
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
