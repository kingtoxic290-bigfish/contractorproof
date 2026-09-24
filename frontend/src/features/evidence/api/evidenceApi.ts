import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { parsePublicEvidence, type PublicEvidence } from "../types";

function unwrapEvidenceData(payload: unknown): unknown {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    return undefined;
  }
  return payload.data.evidence;
}

export async function listEvidence(filters: {
  milestoneId?: string;
  projectId?: string;
} = {}): Promise<PublicEvidence[]> {
  const params = new URLSearchParams();
  if (filters.milestoneId) {
    params.set("milestoneId", filters.milestoneId);
  }
  if (filters.projectId) {
    params.set("projectId", filters.projectId);
  }
  const query = params.toString();
  const payload = await apiRequest<unknown>(query ? `/evidence?${query}` : "/evidence");
  const records = unwrapEvidenceData(payload);
  if (!Array.isArray(records)) {
    throw new Error("The evidence list response is not in a known format.");
  }

  const evidence = records
    .map(parsePublicEvidence)
    .filter((record): record is PublicEvidence => record !== null);
  if (evidence.length !== records.length) {
    throw new Error("The evidence list response is not in a known format.");
  }
  return evidence;
}

export async function createEvidence(input: {
  milestoneId: string;
  file: File;
}): Promise<PublicEvidence> {
  const body = new FormData();
  body.append("milestoneId", input.milestoneId);
  body.append("file", input.file);

  const payload = await apiRequest<unknown>("/evidence", {
    method: "POST",
    body,
  });
  const record = parsePublicEvidence(unwrapEvidenceData(payload));
  if (!record) {
    throw new Error("The evidence upload response is not in a known format.");
  }
  return record;
}
