import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { loadContractorHistory } from "../api/passportsApi";

export function useContractorHistory(contractorId?: string) {
  const enabled = Boolean(contractorId);
  const loader = useCallback(() => {
    if (!contractorId) {
      return Promise.reject(new Error("contractorId is required"));
    }
    return loadContractorHistory(contractorId);
  }, [contractorId]);
  return useAsyncResource(loader, enabled);
}
