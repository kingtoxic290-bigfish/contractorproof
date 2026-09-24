export const EVIDENCE_STATUSES = [
  "MATCH",
  "MISMATCH",
  "PENDING",
  "UNAVAILABLE",
  "VERIFIED",
  "REJECTED",
  "DISPUTED",
] as const;

export type EvidenceStatus = (typeof EVIDENCE_STATUSES)[number];

export const STATUS_LABELS: Record<EvidenceStatus, string> = {
  MATCH: "Match",
  MISMATCH: "Mismatch",
  PENDING: "Pending",
  UNAVAILABLE: "Unavailable",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
  DISPUTED: "Disputed",
};
