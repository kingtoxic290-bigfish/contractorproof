export { evidenceService, EvidenceService } from "./evidence.service";
export {
  verificationService,
  VerificationService,
  VERIFICATION_MATCH_MEANING,
  VERIFICATION_MISMATCH_MEANING,
  VERIFICATION_PENDING_MEANING,
  VERIFICATION_UNAVAILABLE_MEANING,
} from "./verification.service";
export { EvidenceError, EVIDENCE_ERROR_CODES } from "./errors";
export { EVIDENCE_MAX_FILE_BYTES, EVIDENCE_ALLOWED_TYPES } from "./config";
export { hashEvidenceBytes } from "./hash";
export type {
  AppendEvidenceInput,
  CompareInput,
  CompareTargetInput,
  EvidenceBytes,
  EvidenceView,
  EvidenceVersionView,
  PublicVerificationView,
  UploadEvidenceInput,
  VerificationView,
} from "./types";
