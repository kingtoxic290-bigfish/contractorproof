import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import { QueryPanel } from "../../shared/QueryPanel";
import { useAttestation } from "../../verification/hooks/useAttestation";
import { useMilestone } from "../hooks/useMilestone";
import { useMilestoneHistory, useMilestoneTransition } from "../hooks/useMilestoneHistory";
import { MilestoneHistoryTimeline, MilestoneStatusBadge } from "../components/MilestoneExecutionSummary";
import type { QueryStatus } from "../../shared/query";

function isUnloadedStatus(status: QueryStatus): boolean {
  return status === "error" || status === "unavailable" || status === "forbidden" ||
    status === "unauthorized" || status === "notfound";
}

/**
 * Client review of one milestone submission.
 *
 * Approval here means exactly one thing: the client reviewed this submission
 * and approved it. It is not a statement that the contractor is trustworthy, and
 * nothing on this page is aggregated into a judgement.
 *
 * The three outcomes are deliberately distinct records:
 *   - approval / rejection  -> an attestation, then a milestone status transition
 *   - correction request     -> the existing corrections workflow
 *   - dispute                -> the existing disputes workflow
 */
export function MilestoneReviewPage() {
  const { milestoneId } = useParams();
  const { hasRole } = useAuth();
  const milestone = useMilestone(milestoneId);
  const history = useMilestoneHistory(milestoneId);
  const evidence = useEvidence(milestoneId, undefined, milestone.status === "success");
  const attestation = useAttestation();
  const transition = useMilestoneTransition(milestoneId, history);

  const [reason, setReason] = useState("");
  const [selectedEvidenceId, setSelectedEvidenceId] = useState("");

  const canReview = hasRole("CLIENT", "ADMIN");
  const records = evidence.records ?? [];
  const evidenceId = selectedEvidenceId || records[0]?.id || "";

  if (!canReview) {
    return (
      <section className="space-y-4">
        <PageHeader title="Review submission" />
        <ErrorState message="Milestone review is available to the owning client and administrators." />
      </section>
    );
  }

  async function record(decision: "APPROVED" | "REJECTED") {
    if (!milestoneId || !evidenceId) {
      return;
    }
    const recorded = await attestation.attest({
      milestoneId,
      evidenceId,
      decision,
      ...(reason.trim() ? { comment: reason.trim() } : {}),
    });
    if (!recorded) {
      return;
    }
    await transition.submit({
      status: decision === "APPROVED" ? "VERIFIED" : "REJECTED",
      evidenceId,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    });
    setReason("");
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title={milestone.data ? `Review: ${milestone.data.name}` : "Review submission"}
        description="Record your review of this milestone submission. Approval confirms you reviewed the submission; it is not a judgement about the contractor."
      />
      <p>
        <Link
          to={milestone.data ? `/milestones/${encodeURIComponent(milestone.data.id)}` : "/milestones"}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to milestone
        </Link>
      </p>

      <QueryPanel
        status={milestone.status}
        error={milestone.error}
        onRetry={() => void milestone.retry()}
        loadingMessage="Loading milestone information..."
      >
        {milestone.data ? (
          <Card title="Submission under review">
            <p className="text-sm text-stone-700">
              Current milestone status <MilestoneStatusBadge status={milestone.data.status} />
            </p>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <label className="block min-w-0" htmlFor="review-evidence">
                <span className="mb-1 block font-medium text-stone-800">Evidence reviewed</span>
                <select
                  id="review-evidence"
                  value={evidenceId}
                  onChange={(event) => setSelectedEvidenceId(event.target.value)}
                  disabled={records.length === 0}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  {records.length === 0 ? (
                    <option value="">No evidence submitted</option>
                  ) : null}
                  {records.map((record) => (
                    <option key={record.id} value={record.id}>
                      {record.fileName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block min-w-0" htmlFor="review-reason">
                <span className="mb-1 block font-medium text-stone-800">Review note (optional)</span>
                <input
                  id="review-reason"
                  type="text"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                type="button"
                disabled={!evidenceId || attestation.phase === "submitting" || transition.submitting}
                onClick={() => void record("APPROVED")}
              >
                Approve submission
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={!evidenceId || attestation.phase === "submitting" || transition.submitting}
                onClick={() => void record("REJECTED")}
              >
                Reject submission
              </Button>
              {milestone.data ? (
                <>
                  <Link
                    to={`/corrections?milestoneId=${encodeURIComponent(milestone.data.id)}`}
                    className="inline-flex items-center rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                  >
                    Request correction
                  </Link>
                  <Link
                    to={`/disputes?milestoneId=${encodeURIComponent(milestone.data.id)}`}
                    className="inline-flex items-center rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                  >
                    Raise dispute
                  </Link>
                </>
              ) : null}
            </div>

            {attestation.error ? <ErrorState message={attestation.error} /> : null}
            {transition.error ? <ErrorState message={transition.error} /> : null}
            {transition.result ? (
              <p role="status" className="text-sm font-medium text-emerald-800">
                Milestone recorded as {transition.result.milestone.status}.
              </p>
            ) : null}
            {records.length === 0 ? (
              <p className="mt-3 text-sm text-stone-600">
                No evidence has been submitted for this milestone yet, so there is nothing to approve.
              </p>
            ) : null}
          </Card>
        ) : null}
      </QueryPanel>

      {milestone.data ? (
        <Card title="Recorded history">
          {history.status === "loading" ? (
            <p className="text-sm text-stone-600">Loading status history...</p>
          ) : isUnloadedStatus(history.status) ? (
            <p className="text-sm text-stone-600">
              {history.status === "forbidden" || history.status === "unauthorized"
                ? "Status history is not available to you."
                : "Status history could not be loaded. This does not mean it is absent."}
            </p>
          ) : history.data ? (
            <MilestoneHistoryTimeline entries={history.data} />
          ) : (
            <p className="text-sm text-stone-600">No status history recorded yet.</p>
          )}
        </Card>
      ) : null}
    </section>
  );
}
