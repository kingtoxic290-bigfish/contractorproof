import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getOfficialProjectPassport } from "../api/passportsApi";

export function useOfficialProjectPassport(projectId?: string) {
  const enabled = Boolean(projectId);
  const loader = useCallback(() => {
    if (!projectId) return Promise.reject(new Error("projectId is required"));
    return getOfficialProjectPassport(projectId);
  }, [projectId]);
  return useAsyncResource(loader, enabled);
}