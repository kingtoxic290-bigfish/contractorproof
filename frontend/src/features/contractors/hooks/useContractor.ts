import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getContractor } from "../api/contractorsApi";

export function useContractor(contractorId: string | undefined) {
  const loader = useCallback(() => {
    if (!contractorId) {
      return Promise.reject(new Error("A contractor identifier is required."));
    }
    return getContractor(contractorId);
  }, [contractorId]);

  return useAsyncResource(loader, Boolean(contractorId));
}
