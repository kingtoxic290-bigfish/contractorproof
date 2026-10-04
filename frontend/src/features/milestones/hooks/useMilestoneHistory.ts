import { useCallback, useState } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listMilestoneHistory, transitionMilestone } from "../api/milestonesApi";
import type { MilestoneStatusHistoryEntry, PublicMilestone } from "../types";

export function useMilestoneHistory(milestoneId: string | undefined) {
  const loader = useCallback(() => {
    if (!milestoneId) {
      return Promise.reject(new Error("A milestone identifier is required."));
    }
    return listMilestoneHistory(milestoneId);
  }, [milestoneId]);

  return useAsyncResource(loader, Boolean(milestoneId));
}

export type MilestoneTransitionState = {
  submitting: boolean;
  error: string | null;
  result: { milestone: PublicMilestone; historyEntry: MilestoneStatusHistoryEntry } | null;
};

/**
 * Record a milestone status transition and keep the locally loaded history in
 * step with what the server actually appended.
 *
 * The response is the authority: the milestone and the appended history entry
 * both come back from the server, so the UI never predicts an outcome the
 * backend did not accept.
 */
export function useMilestoneTransition(
  milestoneId: string | undefined,
  history: { retry: () => void } | undefined,
) {
  const [state, setState] = useState<MilestoneTransitionState>({
    submitting: false,
    error: null,
    result: null,
  });

  const submit = useCallback(
    async (input: { status: string; evidenceId?: string; reason?: string }) => {
      if (!milestoneId) {
        return;
      }
      setState({ submitting: true, error: null, result: null });
      try {
        const result = await transitionMilestone(milestoneId, input);
        setState({ submitting: false, error: null, result });
        history?.retry();
      } catch (cause) {
        setState({
          submitting: false,
          error: cause instanceof Error ? cause.message : "The transition was rejected.",
          result: null,
        });
      }
    },
    [milestoneId, history],
  );

  const clear = useCallback(() => {
    setState({ submitting: false, error: null, result: null });
  }, []);

  return { ...state, submit, clear };
}
