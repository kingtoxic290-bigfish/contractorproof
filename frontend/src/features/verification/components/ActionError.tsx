import { ErrorState } from "../../../components/feedback/ErrorState";
import type { ActionPhase } from "../types";

const PHASE_TITLE: Record<ActionPhase, string> = {
  ready: "Ready",
  submitting: "Submitting",
  recorded: "Recorded",
  failed: "Failed",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  notfound: "Not found",
  conflict: "Conflict",
  validation: "Validation",
  unavailable: "Service unavailable",
};

export function ActionError({
  phase,
  error,
  onRetry,
}: {
  phase: ActionPhase;
  error: string | null;
  onRetry?: () => void;
}) {
  if (!error) {
    return null;
  }

  const retryable = phase === "failed" || phase === "unavailable";

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{PHASE_TITLE[phase]}</p>
      <ErrorState message={error} onRetry={retryable ? onRetry : undefined} />
    </div>
  );
}
