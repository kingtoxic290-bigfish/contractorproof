import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { parsePublicAttestation, type AttestationDecision, type PublicAttestation } from "../types";

function unwrapAttestationData(payload: unknown): unknown {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    return undefined;
  }
  return payload.data.attestation;
}

export async function createAttestation(input: {
  evidenceId: string;
  milestoneId: string;
  decision: AttestationDecision;
  comment?: string;
}): Promise<PublicAttestation> {
  const payload = await apiRequest<unknown>("/attestations", {
    method: "POST",
    body: {
      evidenceId: input.evidenceId,
      milestoneId: input.milestoneId,
      decision: input.decision,
      ...(input.comment ? { comment: input.comment } : {}),
    },
  });
  const record = parsePublicAttestation(unwrapAttestationData(payload));
  if (!record) {
    throw new Error("The attestation response is not in a known format.");
  }
  return record;
}
