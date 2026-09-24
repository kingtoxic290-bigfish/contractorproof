import { apiRequest } from "../../../services/api/client";
import type { CrbLookupResponse } from "../types";

export function lookupCrb(registrationNumber: string): Promise<CrbLookupResponse> {
  return apiRequest<CrbLookupResponse>(
    `/integrations/crb/${encodeURIComponent(registrationNumber.trim())}`,
  );
}
