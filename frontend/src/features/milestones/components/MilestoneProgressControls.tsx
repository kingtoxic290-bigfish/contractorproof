import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useAuth } from "../../../hooks/useAuth";
import { useMilestoneTransition } from "../hooks/useMilestoneHistory";
import { milestoneStatusLabel } from "./MilestoneExecutionSummary";
import { MILESTONE_STATUSES, type PublicMilestone } from "../types";

/**
 * Contractor progress recording.
 *
 * Only the transitions a contractor is allowed to make are offered:
 * PENDING → IN_PROGRESS, and IN_PROGRESS → PENDING_VERIFICATION. Submitting
 * for verification requires evidence, because the server refuses a submission
 * transition without it.
 *
 * Approval and rejection are deliberately absent. A contractor cannot record
 * the client review outcome, and the server rejects the attempt regardless of
 * what this component renders.
 */
const CONTRACTOR_NEXT_STATUS: Record<string, { status: string; label: string } | undefined> = {
  PENDING: { status: "IN_PROGRESS", label: "Start work" },
  IN_PROGRESS: { status: "PENDING_VERIFICATION", label: "Submit for verification" },
  REJECTED: { status: "IN_PROGRESS", label: "Resume work" },
};

export function MilestoneProgressControls({
  milestone,
  evidenceIds,
  onRecorded,
  historyRefresh,
}: {
  milestone: PublicMilestone;
  evidenceIds: string[];
  onRecorded: (status: string) => void;
  historyRefresh: () => void;
}) {
  const { hasRole } = useAuth();
  const [reason, setReason] = useState("");
  const transition = useMilestoneTransition(milestone.id, { retry: historyRefresh });

  if (!hasRole("CONTRACTOR", "ADMIN")) {
    return null;
  }

  const next = CONTRACTOR_NEXT_STATUS[milestone.status];
  if (!next) {
    return (
      <p className="text-sm text-stone-600">
        No further progress transition is available from{" "}
        {milestoneStatusLabel(milestone.status)}.
      </p>
    );
  }

  const requiresEvidence = next.status === "PENDING_VERIFICATION";
  const evidenceId = evidenceIds[0] ?? "";
  const blocked = requiresEvidence && !evidenceId;

  return (
    <div className="space-y-3">
      <p className="text-sm text-stone-600">
        Record factual progress on this milestone. Approving the submission is the client&rsquo;s
        decision and is not available here.
      </p>
      <label className="block text-sm" htmlFor={`progress-reason-${milestone.id}`}>
        <span className="mb-1 block font-medium text-stone-800">Progress note (optional)</span>
        <textarea
          id={`progress-reason-${milestone.id}`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-[80px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        />
      </label>
      {blocked ? (
        <p className="text-sm text-stone-600">
          Upload evidence for this milestone before submitting it for verification.
        </p>
      ) : null}
      <Button
        type="button"
        variant="secondary"
        disabled={transition.submitting || blocked}
        onClick={() => {
          void transition
            .submit({
              status: next.status,
              ...(requiresEvidence && evidenceId ? { evidenceId } : {}),
              ...(reason.trim() ? { reason: reason.trim() } : {}),
            })
            .then(() => {
              if (!transition.error) {
                setReason("");
                onRecorded(next.status);
              }
            });
        }}
      >
        {transition.submitting ? "Recording..." : next.label}
      </Button>
      {transition.result ? (
        <p role="status" className="text-sm font-medium text-emerald-800">
          Recorded {MILESTONE_STATUSES.includes(transition.result.milestone.status as never) ? transition.result.milestone.status : next.status}.
        </p>
      ) : null}
      {transition.error ? <ErrorState message={transition.error} /> : null}
    </div>
  );
}
