import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getMilestone } from "../api/milestonesApi";

export function useMilestone(milestoneId: string | undefined) {
  const loader = useCallback(() => {
    if (!milestoneId) {
      return Promise.reject(new Error("A milestone identifier is required."));
    }
    return getMilestone(milestoneId);
  }, [milestoneId]);

  return useAsyncResource(loader, Boolean(milestoneId));
}