import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listProjects } from "../api/projectsApi";

export function useProjects() {
  const loader = useCallback(() => listProjects(), []);
  const query = useAsyncResource(loader);
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  return {
    ...query,
    status,
    records,
  };
}
