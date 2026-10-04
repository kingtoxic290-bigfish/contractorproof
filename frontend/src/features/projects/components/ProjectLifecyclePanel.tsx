import { useMemo } from "react";
import { Flag, ListChecks } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { QueryPanel } from "../../shared/QueryPanel";
import { StateLabel } from "../../shared/StateLabel";
import { formatDateTime } from "../../../utils/format";
import { useProjectLifecycleHistory } from "../hooks/useProjectLifecycleHistory";
import {
  PROJECT_LIFECYCLE_STATUSES,
  projectLifecycleLabel,
  projectLifecycleMeaning,
  type ProjectLifecycleHistoryEntry,
  type ProjectLifecycleStatus,
} from "../types";

/**
 * Milestone status counts used for execution readiness.
 *
 * Only the canonical milestone statuses are counted. Anything the server has not
 * recorded as one of them is surfaced as "other recorded status" rather than
 * being folded into a favourable count.
 */
export type MilestoneReadiness = {
  total: number;
  verified: number;
  awaitingVerification: number;
  rejected: number;
  pending: number;
  inProgress: number;
  other: number;
  allVerified: boolean;
};

export function milestoneReadiness(
  milestones: Array<{ status: string }> | undefined,
): MilestoneReadiness {
  const records = milestones ?? [];
  const readiness: MilestoneReadiness = {
    total: records.length,
    verified: 0,
    awaitingVerification: 0,
    rejected: 0,
    pending: 0,
    inProgress: 0,
    other: 0,
    allVerified: false,
  };

  for (const milestone of records) {
    switch (milestone.status) {
      case "VERIFIED":
        readiness.verified += 1;
        break;
      case "PENDING_VERIFICATION":
        readiness.awaitingVerification += 1;
        break;
      case "REJECTED":
        readiness.rejected += 1;
        break;
      case "PENDING":
        readiness.pending += 1;
        break;
      case "IN_PROGRESS":
        readiness.inProgress += 1;
        break;
      default:
        readiness.other += 1;
    }
  }

  readiness.allVerified = readiness.total > 0 && readiness.verified === readiness.total;
  return readiness;
}

function LifecycleHistoryList({ entries }: { entries: ProjectLifecycleHistoryEntry[] }) {
  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const recorded = formatDateTime(entry.createdAt) ?? entry.createdAt;
        return (
          <li key={entry.id} className="border-l-2 border-stone-200 pl-3">
            <p className="text-sm text-stone-900">
              {entry.previousStatus
                ? `${entry.previousStatus} → ${entry.newStatus}`
                : `Recorded as ${entry.newStatus}`}
            </p>
            <p className="text-xs text-stone-500">
              <time dateTime={entry.createdAt}>{recorded}</time>
              {entry.actorRole ? ` · ${entry.actorRole}` : ""}
              {entry.actorName ? ` · ${entry.actorName}` : ""}
              {entry.isBaseline ? " · baseline record" : ""}
            </p>
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
 * Project lifecycle and execution readiness.
 *
 * This panel is read-only. It reports the lifecycle state the server stored and
 * whether the recorded milestones satisfy the server's own execution rule, so a
 * reviewer can see why the project has not moved on. Nothing here changes a
 * project state, and the server remains the only authority on every transition.
 */
export function ProjectLifecyclePanel({
  projectId,
  lifecycleStatus,
  readiness,
}: {
  projectId: string;
  lifecycleStatus?: ProjectLifecycleStatus;
  /** null while the milestone records this depends on are still loading. */
  readiness: MilestoneReadiness | null;
}) {
  const history = useProjectLifecycleHistory(projectId);
  const status = lifecycleStatus ?? null;

  const readinessSummary = useMemo(() => {
    if (!readiness) {
      return "Milestone states are still loading. Execution readiness is not stated until the milestone records have loaded.";
    }
    if (readiness.total === 0) {
      return "No milestones are recorded for this project, so execution cannot be completed yet.";
    }
    if (readiness.allVerified) {
      return `All ${readiness.total} recorded milestone${readiness.total === 1 ? " is" : "s are"} verified. The client or administrator may record execution completion; the server decides whether the transition is accepted.`;
    }
    return `${readiness.verified} of ${readiness.total} recorded milestone${readiness.total === 1 ? " is" : "s are"} verified. Execution completion is available only when every recorded milestone is verified.`;
  }, [readiness]);

  return (
    <Card
      title="Project lifecycle"
      description="The recorded project state. A verified milestone is a milestone outcome; the project lifecycle is a separate, client or administrator decision."
      icon={ListChecks}
    >
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Recorded project state</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {status ? <StateLabel value={status} /> : (
              <span className="text-sm text-stone-600">Not returned by the API</span>
            )}
            {status ? (
              <span className="text-sm font-medium text-stone-900">
                {projectLifecycleLabel(status)}
              </span>
            ) : null}
          </div>
          <p className="mt-2 text-sm text-stone-600">
            {status
              ? projectLifecycleMeaning(status)
              : "This response did not include a lifecycle state, so no project state is claimed."}
          </p>
        </div>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-stone-900">
            <Flag className="h-4 w-4" aria-hidden="true" /> Execution readiness
          </p>
          <p className="mt-1 text-sm text-stone-700">{readinessSummary}</p>
          {readiness ? (
            <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
              <div>
                <dt className="text-stone-500">Verified</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{readiness.verified}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Awaiting verification</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{readiness.awaitingVerification}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Rework required</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{readiness.rejected}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Not started</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{readiness.pending}</dd>
              </div>
              <div>
                <dt className="text-stone-500">In progress</dt>
                <dd className="mt-0.5 font-medium text-stone-900">{readiness.inProgress}</dd>
              </div>
              {readiness.other > 0 ? (
                <div>
                  <dt className="text-stone-500">Other recorded status</dt>
                  <dd className="mt-0.5 font-medium text-stone-900">{readiness.other}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
          <p className="mt-3 text-xs leading-5 text-stone-600">
            Lifecycle order recorded by the server: {PROJECT_LIFECYCLE_STATUSES.join(" → ")}.
            Completing a milestone does not complete the project.
          </p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Recorded lifecycle history</p>
          <div className="mt-1">
            <QueryPanel
              status={history.status}
              error={history.error}
              onRetry={() => void history.retry()}
              loadingMessage="Loading project lifecycle history..."
              emptyTitle="No lifecycle transitions recorded."
              emptyDescription="No project lifecycle transition has been recorded for this project."
            >
              <LifecycleHistoryList entries={history.entries} />
            </QueryPanel>
          </div>
        </div>
      </div>
    </Card>
  );
}