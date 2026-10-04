import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { formatDateTime } from "../../../utils/format";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import { EvidenceStatus } from "../../evidence/components/EvidenceStatus";
import { VerificationStatus } from "../../verification/components/VerificationStatus";
import { useMilestoneWorkflowCounts } from "../hooks/useMilestoneWorkflowCounts";
import type { QueryStatus } from "../../shared/query";
import type { MilestoneStatusHistoryEntry, PublicMilestone } from "../types";

/**
 * Milestone status is shown as the exact Prisma MilestoneStatus value. No
 * colour, icon or wording is used that would imply a judgement beyond the
 * recorded state, and no percentage is shown because the model records statuses
 * and counts, not a numeric progress value.
 */
const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  IN_PROGRESS: "In progress",
  PENDING_VERIFICATION: "Pending verification",
  VERIFIED: "Verified",
  REJECTED: "Rejected",
};

export function milestoneStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/**
 * What each canonical milestone state means for the work.
 *
 * These describe the workflow, not the contractor. A rejected milestone is a
 * recorded outcome about a submission, never a judgement about the contractor.
 */
const STATUS_MEANINGS: Record<string, string> = {
  PENDING: "Work has not started on this milestone.",
  IN_PROGRESS: "The assigned contractor is executing this milestone.",
  PENDING_VERIFICATION:
    "Evidence has been submitted and is awaiting a recorded verification result and client review.",
  VERIFIED: "This milestone passed verification and client review.",
  REJECTED:
    "The recorded submission was rejected. Rework and a new evidence version are required.",
};

export function milestoneStatusMeaning(status: string): string {
  return STATUS_MEANINGS[status] ?? "The API returned a state this screen does not describe.";
}

/**
 * Guidance shown for the roles that act on this milestone.
 *
 * It restates the recorded state and the next recorded step. It grants nothing:
 * every action remains subject to the same server authorization, and no state is
 * changed here.
 */
export function milestoneNextStep(
  status: string,
  perspective: "execute" | "review",
): string | null {
  if (perspective === "execute") {
    switch (status) {
      case "PENDING":
        return "Next step: start the milestone to record that work has begun.";
      case "IN_PROGRESS":
        return "Next step: upload evidence for this milestone, then submit it for verification.";
      case "REJECTED":
        return "Next step: review the recorded outcome, rework the milestone, upload a new evidence version, then submit it for verification again.";
      case "PENDING_VERIFICATION":
        return "This milestone is with the client for review. Further changes wait for the recorded review decision.";
      case "VERIFIED":
        return "No further execution step is available on this milestone.";
      default:
        return null;
    }
  }

  switch (status) {
    case "PENDING":
    case "IN_PROGRESS":
      return "Nothing has been submitted for review yet. The assigned contractor is responsible for the execution steps.";
    case "PENDING_VERIFICATION":
      return "Next step: review the submitted evidence and record the review decision.";
    case "REJECTED":
      return "The rework is executed by the assigned contractor. Review the new submission when it is resubmitted.";
    case "VERIFIED":
      return "This milestone is verified and counts towards project execution completion.";
    default:
      return null;
  }
}

export function MilestoneStatusBadge({ status }: { status: string }) {
  return (
    <span className="inline-flex items-center rounded border border-stone-300 bg-stone-50 px-2 py-0.5 text-xs font-medium text-stone-800">
      {milestoneStatusLabel(status)}
    </span>
  );
}

function Count({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-stone-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-stone-900">{value}</dd>
    </div>
  );
}

/**
 * A request that did not succeed must never be rendered as "nothing was
 * recorded". A failed lookup and an empty history look identical once both have
 * become an empty array, and the difference matters: one is a fact about the
 * project, the other is a statement about this session.
 */
function isUnloaded(status: QueryStatus): boolean {
  return status === "error" || status === "unavailable" || status === "forbidden" ||
    status === "unauthorized" || status === "notfound";
}

function unloadedMessage(status: QueryStatus, subject: string): string {
  if (status === "forbidden" || status === "unauthorized") {
    return `${subject} are not available to you.`;
  }
  if (status === "notfound") {
    return `${subject} could not be found for this milestone.`;
  }
  return `${subject} could not be loaded. This does not mean they are absent.`;
}

export function MilestoneHistoryTimeline({
  entries,
}: {
  entries: MilestoneStatusHistoryEntry[];
}) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-stone-600">No recorded status history for this milestone yet.</p>
    );
  }

return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const recorded = formatDateTime(entry.createdAt) ?? entry.createdAt;
        return (
          <li key={entry.id} className="border-l-2 border-stone-200 pl-3">
            <p className="text-sm text-stone-900">
              {entry.previousStatus
                ? `${milestoneStatusLabel(entry.previousStatus)} → ${milestoneStatusLabel(entry.newStatus)}`
                : `Created as ${milestoneStatusLabel(entry.newStatus)}`}
            </p>
            <p className="text-xs text-stone-500">
              <time dateTime={entry.createdAt}>{recorded}</time>
              {entry.actorRole ? ` · ${entry.actorRole}` : ""}
              {entry.actorName ? ` · ${entry.actorName}` : ""}
              {entry.isBaseline ? " · baseline record" : ""}
            </p>
            {/* The evidence reference is the recorded evidence identifier. No
                internal actor identifier is read or shown. */}
            {entry.evidenceId ? (
              <p className="mt-1 break-all text-xs text-stone-500">
                Evidence referenced: {entry.evidenceId}
              </p>
            ) : null}
            {entry.reason ? (
              <p className="mt-1 whitespace-pre-wrap text-sm text-stone-700">{entry.reason}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * The factual execution state of one milestone.
 *
 * Everything shown is a stored status or a count of stored records: milestone
 * status, evidence submitted, technical verification, client review decisions,
 * corrections and disputes. These are different events and are labelled
 * separately. There is no combined score, ranking or verdict, and nothing here
 * is interpreted as contractor fault.
 */
export function MilestoneExecutionSummary({
  milestone,
  history,
  historyStatus,
}: {
  milestone: Pick<PublicMilestone, "id" | "name" | "status">;
  history: MilestoneStatusHistoryEntry[];
  historyStatus: QueryStatus;
}) {
  const { hasRole } = useAuth();
  const evidence = useEvidence(milestone.id, undefined, true);
  const workflow = useMilestoneWorkflowCounts(milestone.id);

  const records = evidence.records ?? [];
  const latest = records[0];
  const verificationStatus = latest?.verificationStatus ?? "PENDING";
  const evidenceStatus = latest?.status ?? "NO_EVIDENCE";
  const counts = workflow.data;
  // Until the request has actually succeeded, the count is unknown rather than
  // zero.
  const evidenceCount = isUnloaded(evidence.status) ? "—" : records.length;

  // These mirror the server's permission rules. The server remains the
  // authority: hiding a control is a usability measure, not the control.
  const canSubmitProgress = hasRole("CONTRACTOR", "ADMIN");
  const canApprove = hasRole("CLIENT", "ADMIN");
  const nextStep = milestoneNextStep(
    milestone.status,
    canSubmitProgress ? "execute" : "review",
  );

  return (
    <div className="space-y-4">
      <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
        <div className="min-w-0">
          <dt className="text-stone-500">Milestone status</dt>
          <dd className="mt-0.5">
            <MilestoneStatusBadge status={milestone.status} />
          </dd>
          <dd className="mt-1 text-xs leading-5 text-stone-600">
            {milestoneStatusMeaning(milestone.status)}
          </dd>
        </div>
        <Count label="Evidence records" value={evidenceCount} />
        <div className="min-w-0">
          <dt className="text-stone-500">Technical verification</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            <VerificationStatus status={verificationStatus} />
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-stone-500">Evidence workflow state</dt>
          <dd className="mt-0.5 font-medium text-stone-900">
            <EvidenceStatus status={evidenceStatus} verificationStatus={verificationStatus} />
          </dd>
        </div>
      </dl>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Recorded review events
        </h3>
        {workflow.status === "loading" ? (
          <p className="mt-1 text-sm text-stone-600">Loading recorded review events...</p>
        ) : isUnloaded(workflow.status) ? (
          <p className="mt-1 text-sm text-stone-600">
            {unloadedMessage(workflow.status, "Recorded review events")}
          </p>
        ) : counts ? (
          <dl className="mt-1 grid gap-3 text-xs sm:grid-cols-3">
            <Count label="Client approvals" value={counts.approvedAttestations} />
            <Count
              label="Corrections requested"
              value={counts.corrections}
              />
            <Count label="Disputes raised" value={counts.disputes} />
            {counts.openCorrections > 0 ? (
              <Count label="Corrections awaiting resolution" value={counts.openCorrections} />
            ) : null}
            {counts.openDisputes > 0 ? (
              <Count label="Disputes awaiting resolution" value={counts.openDisputes} />
            ) : null}
            {counts.rejectedAttestations > 0 ? (
              <Count label="Client rejections" value={counts.rejectedAttestations} />
            ) : null}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-stone-600">
            No recorded review events for this milestone.
          </p>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">
          Status history
        </h3>
        <div className="mt-1">
          {historyStatus === "loading" ? (
            <p className="text-sm text-stone-600">Loading status history...</p>
          ) : isUnloaded(historyStatus) ? (
            <p className="text-sm text-stone-600">
              {unloadedMessage(historyStatus, "Status history")}
            </p>
          ) : (
            <MilestoneHistoryTimeline entries={history} />
          )}
        </div>
      </div>

      {nextStep ? (
        <p className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
          {nextStep}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Link
          to={`/evidence?milestoneId=${encodeURIComponent(milestone.id)}`}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          View evidence
        </Link>
        <Link
          to={`/corrections?milestoneId=${encodeURIComponent(milestone.id)}`}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Corrections
        </Link>
        <Link
          to={`/disputes?milestoneId=${encodeURIComponent(milestone.id)}`}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Disputes
        </Link>
        {canSubmitProgress ? (
          <Link
            to={`/milestones/${encodeURIComponent(milestone.id)}`}
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Record progress
          </Link>
        ) : null}
        {canApprove ? (
          <Link
            to={`/milestones/${encodeURIComponent(milestone.id)}/review`}
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Review submission
          </Link>
        ) : null}
      </div>
    </div>
  );
}
