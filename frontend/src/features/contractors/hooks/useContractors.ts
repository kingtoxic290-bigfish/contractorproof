import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listContractors } from "../api/contractorsApi";

export function useContractors() {
  const loader = useCallback(() => listContractors(), []);
  const query = useAsyncResource(loader);
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  return {
    ...query,
    status,
    records,
  };
}
