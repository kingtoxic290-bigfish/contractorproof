import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listEvidence } from "../api/evidenceApi";

export function useEvidence(milestoneId?: string, projectId?: string, enabled = true) {
  const loader = useCallback(
    () => listEvidence({ milestoneId, projectId }),
    [milestoneId, projectId],
  );
  const query = useAsyncResource(loader, enabled);
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  return {
    ...query,
    status,
    records,
  };
}
