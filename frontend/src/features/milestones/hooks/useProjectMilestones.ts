import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listProjectMilestones } from "../api/milestonesApi";

export function useProjectMilestones(projectId: string | undefined) {
  const loader = useCallback(() => {
    if (!projectId) {
      return Promise.reject(new Error("A project identifier is required."));
    }
    return listProjectMilestones(projectId);
  }, [projectId]);

  const query = useAsyncResource(loader, Boolean(projectId));
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  return {
    ...query,
    status,
    records,
  };
}
