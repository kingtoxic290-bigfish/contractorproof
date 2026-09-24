import { isAttestationDecision, type AttestationDecision } from "./types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export type VerificationTargetInput = {
  evidenceId?: string;
  evidenceVersionId?: string;
};

export type VerificationTargetResult =
  | { ok: true; evidenceId?: string; evidenceVersionId?: string }
  | { ok: false; reason: "missing_target" | "invalid_uuid" };

export function validateVerificationTarget(input: VerificationTargetInput): VerificationTargetResult {
  const evidenceId = input.evidenceId?.trim() || undefined;
  const evidenceVersionId = input.evidenceVersionId?.trim() || undefined;

  if (!evidenceId && !evidenceVersionId) {
    return { ok: false, reason: "missing_target" };
  }
  if (evidenceId && !isUuid(evidenceId)) {
    return { ok: false, reason: "invalid_uuid" };
  }
  if (evidenceVersionId && !isUuid(evidenceVersionId)) {
    return { ok: false, reason: "invalid_uuid" };
  }
  return { ok: true, evidenceId, evidenceVersionId };
}

export type AttestationInput = {
  evidenceId?: string;
  milestoneId?: string;
  decision?: string;
  comment?: string;
};

export type AttestationValidationResult =
  | { ok: true; evidenceId: string; milestoneId: string; decision: AttestationDecision; comment?: string }
  | { ok: false; reason: "missing_ids" | "invalid_uuid" | "invalid_decision" };

export function validateAttestationInput(input: AttestationInput): AttestationValidationResult {
  const evidenceId = input.evidenceId?.trim() ?? "";
  const milestoneId = input.milestoneId?.trim() ?? "";
  const decision = input.decision?.trim() ?? "";
  const comment = input.comment?.trim() || undefined;

  if (!evidenceId || !milestoneId) {
    return { ok: false, reason: "missing_ids" };
  }
  if (!isUuid(evidenceId) || !isUuid(milestoneId)) {
    return { ok: false, reason: "invalid_uuid" };
  }
  if (!isAttestationDecision(decision)) {
    return { ok: false, reason: "invalid_decision" };
  }
  return { ok: true, evidenceId, milestoneId, decision, comment };
}

export function targetValidationMessage(reason: "missing_target" | "invalid_uuid"): string {
  if (reason === "missing_target") {
    return "evidenceId or evidenceVersionId is required";
  }
  return "evidenceId and evidenceVersionId must be valid UUIDs";
}

export function attestationValidationMessage(
  reason: "missing_ids" | "invalid_uuid" | "invalid_decision",
): string {
  if (reason === "missing_ids") {
    return "evidenceId and milestoneId are required";
  }
  if (reason === "invalid_uuid") {
    return "evidenceId and milestoneId must be valid UUIDs";
  }
  return "decision must be APPROVED or REJECTED";
}
