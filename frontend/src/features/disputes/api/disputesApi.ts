import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { parsePublicDispute, type DisputeStatus, type PublicDispute } from "../types";

/** Unwraps the shared `{ data, meta }` envelope the backend uses for workflows. */
function unwrapData(payload: unknown): Record<string, unknown> | undefined {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    return undefined;
  }
  return payload.data;
}

function requireDispute(payload: unknown, context: string): PublicDispute {
  const data = unwrapData(payload);
  const record = data ? parsePublicDispute(data.dispute) : null;
  if (!record) {
    throw new Error(`${context} is not in a known format.`);
  }
  return record;
}

export async function listDisputes(filters: {
  projectId?: string;
  milestoneId?: string;
} = {}): Promise<PublicDispute[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.milestoneId) params.set("milestoneId", filters.milestoneId);
  const query = params.toString();

  const payload = await apiRequest<unknown>(`/disputes${query ? `?${query}` : ""}`);
  const data = unwrapData(payload);
  const raw = data?.disputes;
  if (!Array.isArray(raw)) {
    throw new Error("The dispute list response is not in a known format.");
  }
  const records = raw.map(parsePublicDispute);
  if (records.some((entry) => entry === null)) {
    throw new Error("The dispute list response is not in a known format.");
  }
  return records as PublicDispute[];
}

export async function getDispute(disputeId: string): Promise<PublicDispute> {
  const payload = await apiRequest<unknown>(`/disputes/${disputeId}`);
  return requireDispute(payload, "The dispute response");
}

export async function createDispute(input: {
  milestoneId: string;
  reason: string;
  evidenceId?: string;
  originalEventId?: string;
}): Promise<PublicDispute> {
  const payload = await apiRequest<unknown>("/disputes", {
    method: "POST",
    body: {
      milestoneId: input.milestoneId,
      reason: input.reason,
      ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
      ...(input.originalEventId ? { originalEventId: input.originalEventId } : {}),
    },
  });
  return requireDispute(payload, "The dispute response");
}

export async function markDisputeUnderReview(disputeId: string): Promise<PublicDispute> {
  const payload = await apiRequest<unknown>(`/disputes/${disputeId}/review`, {
    method: "POST",
  });
  return requireDispute(payload, "The dispute response");
}

export async function resolveDispute(input: {
  disputeId: string;
  status: Extract<DisputeStatus, "RESOLVED" | "REJECTED">;
  resolution: string;
}): Promise<PublicDispute> {
  const payload = await apiRequest<unknown>(`/disputes/${input.disputeId}/resolutions`, {
    method: "POST",
    body: { status: input.status, resolution: input.resolution },
  });
  return requireDispute(payload, "The dispute response");
}