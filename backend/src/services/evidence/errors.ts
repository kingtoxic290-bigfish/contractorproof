import { RepositoryError } from "../../repositories/errors";

export const EVIDENCE_ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  PROJECT_NOT_FOUND: "PROJECT_NOT_FOUND",
  MILESTONE_NOT_FOUND: "MILESTONE_NOT_FOUND",
  EVIDENCE_NOT_FOUND: "EVIDENCE_NOT_FOUND",
  VERSION_NOT_FOUND: "VERSION_NOT_FOUND",
  FILE_EMPTY: "FILE_EMPTY",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_TYPE_NOT_ALLOWED: "FILE_TYPE_NOT_ALLOWED",
  HASH_CONFLICT: "HASH_CONFLICT",
  STORAGE_FAILED: "STORAGE_FAILED",
  VERIFICATION_UNAVAILABLE: "VERIFICATION_UNAVAILABLE",
  CONFLICT: "CONFLICT",
} as const;

export type EvidenceErrorCode =
  (typeof EVIDENCE_ERROR_CODES)[keyof typeof EVIDENCE_ERROR_CODES];

export class EvidenceError extends RepositoryError {
  constructor(
    public readonly code: EvidenceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "EvidenceError";
  }
}
