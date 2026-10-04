import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getContractorPassport, getOwnContractorPassport } from "../api/contractorsApi";

/** Signed-in CONTRACTOR passport. The identifier comes from the session, not the URL. */
export function useOwnContractorPassport(enabled = true) {
  const loader = useCallback(() => getOwnContractorPassport(), []);
  return useAsyncResource(loader, enabled);
}

/** Contractor passport for a contractor the caller is permitted to read. */
export function useContractorPassport(contractorId: string | undefined) {
  const loader = useCallback(() => {
    if (!contractorId) {
      return Promise.reject(new Error("A contractor identifier is required."));
    }
    return getContractorPassport(contractorId);
  }, [contractorId]);

  return useAsyncResource(loader, Boolean(contractorId));
}