import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listProjectLifecycleHistory } from "../api/projectsApi";

/**
 * Recorded project lifecycle transitions.
 *
 * The panel that uses this never writes a state: every transition shown here was
 * decided and stored by the server.
 */
export function useProjectLifecycleHistory(projectId: string | undefined) {
  const loader = useCallback(() => {
    if (!projectId) {
      return Promise.reject(new Error("A project identifier is required."));
    }
    return listProjectLifecycleHistory(projectId);
  }, [projectId]);

  const query = useAsyncResource(loader, Boolean(projectId));
  const entries = query.data ?? [];

  return {
    ...query,
    status: query.status === "success" && entries.length === 0 ? "empty" : query.status,
    entries,
  };
}