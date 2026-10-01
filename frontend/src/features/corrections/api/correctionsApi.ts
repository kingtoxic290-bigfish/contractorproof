import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { parsePublicCorrection, type CorrectionStatus, type PublicCorrection } from "../types";

/** Unwraps the shared `{ data, meta }` envelope the backend uses for workflows. */
function unwrapData(payload: unknown): Record<string, unknown> | undefined {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    return undefined;
  }
  return payload.data;
}

function requireCorrection(payload: unknown, context: string): PublicCorrection {
  const data = unwrapData(payload);
  const record = data ? parsePublicCorrection(data.correction) : null;
  if (!record) {
    throw new Error(`${context} is not in a known format.`);
  }
  return record;
}

export async function listCorrections(filters: {
  projectId?: string;
  milestoneId?: string;
} = {}): Promise<PublicCorrection[]> {
  const params = new URLSearchParams();
  if (filters.projectId) params.set("projectId", filters.projectId);
  if (filters.milestoneId) params.set("milestoneId", filters.milestoneId);
  const query = params.toString();

  const payload = await apiRequest<unknown>(`/corrections${query ? `?${query}` : ""}`);
  const data = unwrapData(payload);
  const raw = data?.corrections;
  if (!Array.isArray(raw)) {
    throw new Error("The correction list response is not in a known format.");
  }
  const records = raw.map(parsePublicCorrection);
  if (records.some((entry) => entry === null)) {
    throw new Error("The correction list response is not in a known format.");
  }
  return records as PublicCorrection[];
}

export async function getCorrection(correctionId: string): Promise<PublicCorrection> {
  const payload = await apiRequest<unknown>(`/corrections/${correctionId}`);
  return requireCorrection(payload, "The correction response");
}

export async function createCorrection(input: {
  milestoneId: string;
  originalEventId: string;
  reason: string;
  evidenceId?: string;
}): Promise<PublicCorrection> {
  const payload = await apiRequest<unknown>("/corrections", {
    method: "POST",
    body: {
      milestoneId: input.milestoneId,
      originalEventId: input.originalEventId,
      reason: input.reason,
      ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
    },
  });
  return requireCorrection(payload, "The correction response");
}

export async function markCorrectionUnderReview(correctionId: string): Promise<PublicCorrection> {
  const payload = await apiRequest<unknown>(`/corrections/${correctionId}/review`, {
    method: "POST",
  });
  return requireCorrection(payload, "The correction response");
}

export async function resolveCorrection(input: {
  correctionId: string;
  status: Extract<CorrectionStatus, "APPROVED" | "REJECTED">;
  resolution: string;
  correctedEvidenceVersionId?: string;
}): Promise<PublicCorrection> {
  const payload = await apiRequest<unknown>(`/corrections/${input.correctionId}/resolve`, {
    method: "POST",
    body: {
      status: input.status,
      resolution: input.resolution,
      ...(input.correctedEvidenceVersionId
        ? { correctedEvidenceVersionId: input.correctedEvidenceVersionId }
        : {}),
    },
  });
  return requireCorrection(payload, "The correction response");
}