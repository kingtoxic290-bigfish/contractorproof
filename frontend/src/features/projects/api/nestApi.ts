import { apiRequest } from "../../../services/api/client";
import type { NestLookupResponse } from "../types";

export function lookupNest(reference: string): Promise<NestLookupResponse> {
  return apiRequest<NestLookupResponse>(
    `/integrations/nest/${encodeURIComponent(reference.trim())}`,
  );
}
