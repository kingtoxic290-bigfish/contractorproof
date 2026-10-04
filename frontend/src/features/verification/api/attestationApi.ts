import { apiRequest } from "../../../services/api/client";
import { isPlainRecord, unwrapNamedList } from "../../shared/query";
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

/**
 * Client review decisions recorded against a milestone's evidence.
 *
 * An approval means the client reviewed this submission and approved it. It is
 * not a statement about the contractor's trustworthiness and is never aggregated
 * into a score.
 */
export async function listAttestations(filters: {
  milestoneId?: string;
  projectId?: string;
  evidenceId?: string;
}): Promise<PublicAttestation[]> {
  const params = new URLSearchParams();
  if (filters.milestoneId) params.set("milestoneId", filters.milestoneId);
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.evidenceId) params.set("evidenceId", filters.evidenceId);
  const query = params.toString();

  const payload = await apiRequest<unknown>(`/attestations${query ? `?${query}` : ""}`);
  const records = unwrapNamedList(payload, "attestations");
  if (!records) {
    throw new Error("The attestation list response is not in a known format.");
  }

  const attestations = records
    .map(parsePublicAttestation)
    .filter((record): record is PublicAttestation => record !== null);
  if (attestations.length !== records.length) {
    throw new Error("The attestation list response is not in a known format.");
  }
  return attestations;
}
