import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getProject } from "../api/projectsApi";

export function useProject(projectId: string | undefined) {
  const loader = useCallback(() => {
    if (!projectId) {
      return Promise.reject(new Error("A project identifier is required."));
    }
    return getProject(projectId);
  }, [projectId]);

  return useAsyncResource(loader, Boolean(projectId));
}
