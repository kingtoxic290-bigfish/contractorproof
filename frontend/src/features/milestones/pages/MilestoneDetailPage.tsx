import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { EvidenceList } from "../../evidence/components/EvidenceList";
import { MilestoneEvidenceVersions } from "../../evidence/components/EvidenceVersionHistory";
import { EvidenceStatus } from "../../evidence/components/EvidenceStatus";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import { QueryPanel } from "../../shared/QueryPanel";
import { RecordFields } from "../../shared/RecordFields";
import { useAuth } from "../../../hooks/useAuth";
import {
  MilestoneExecutionSummary,
  MilestoneStatusBadge,
  milestoneStatusMeaning,
  milestoneNextStep,
} from "../components/MilestoneExecutionSummary";
import { MilestoneProgressControls } from "../components/MilestoneProgressControls";
import { useMilestone } from "../hooks/useMilestone";
import { useMilestoneHistory } from "../hooks/useMilestoneHistory";

export function MilestoneDetailPage() {
  const { milestoneId } = useParams();
  const { hasRole } = useAuth();
  const milestone = useMilestone(milestoneId);
  const history = useMilestoneHistory(milestoneId);
  const [recordedStatus, setRecordedStatus] = useState<string | null>(null);
  const evidence = useEvidence(
    milestone.data?.id,
    undefined,
    milestone.status === "success" && Boolean(milestone.data),
  );
  const canExecute = hasRole("CONTRACTOR", "ADMIN");
  const evidenceRecords = evidence.records ?? [];
  const currentStatus = recordedStatus ?? milestone.data?.status ?? "";
  const latestEvidence = evidenceRecords[0];
  const nextStep = milestoneNextStep(currentStatus, canExecute ? "execute" : "review");
  // A rework path is offered only when the recorded state actually asks for one:
  // a rejected milestone, or a submitted version whose comparison did not match.
  const reworkRequired =
    canExecute &&
    Boolean(milestone.data) &&
    (currentStatus === "REJECTED" || latestEvidence?.verificationStatus === "MISMATCH");

  return (
    <section className="space-y-6">
      <PageHeader
        title={milestone.data?.name ?? "Milestone"}
        description="Milestone detail, including associated evidence records for this milestone."
      />
      <p>
        <Link
          to={milestone.data ? `/projects/${encodeURIComponent(milestone.data.projectId)}` : "/projects"}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to project
        </Link>
      </p>
      <QueryPanel
        status={milestone.status}
        error={milestone.error}
        onRetry={() => void milestone.retry()}
        loadingMessage="Loading milestone information..."
      >
        {milestone.data ? (
          <Card title="Milestone record">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MilestoneStatusBadge status={currentStatus} />
              <p className="text-sm text-stone-600">{milestoneStatusMeaning(currentStatus)}</p>
            </div>
            <RecordFields record={milestone.data} />
            <Link
              to={`/evidence?milestoneId=${encodeURIComponent(milestone.data.id)}`}
              className="mt-4 inline-block text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              View milestone evidence
            </Link>
          </Card>
        ) : null}
      </QueryPanel>

      {milestone.data ? (
        <Card title="Execution" description="Factual status and recorded review events for this milestone.">
          {nextStep ? (
            <p className="mb-4 rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-800">
              {nextStep}
            </p>
          ) : null}
          <MilestoneExecutionSummary
            milestone={
              recordedStatus
                ? { ...milestone.data, status: recordedStatus }
                : milestone.data
            }
            history={history.data ?? []}
            historyStatus={history.status}
          />
          <div className="mt-6 border-t border-stone-200 pt-4">
            <MilestoneProgressControls
              milestone={milestone.data}
              evidenceIds={evidenceRecords.map((record) => record.id)}
              onRecorded={setRecordedStatus}
              historyRefresh={() => {
                void history.retry();
                // The recorded-status override above only lives in this
                // component. Refreshing the milestone as well keeps the raw
                // record card from disagreeing with the summary beside it.
                void milestone.retry();
              }}
            />
          </div>
        </Card>
      ) : null}
      {reworkRequired && milestone.data ? (
        <Card
          title="Rework this milestone"
          description="The recorded state asks for new evidence. Follow the steps below in order; each step is recorded by the server."
        >
          <ol className="grid gap-2 text-sm text-stone-800">
            <li>1. Review the recorded verification result below. It describes the comparison only, not the contractor.</li>
            <li>2. Rework the milestone and record progress with the reason for the correction.</li>
            <li>
              3. Upload a new evidence version. The earlier version is kept and stays visible with its
              own result.
            </li>
            <li>4. Submit the milestone for verification again.</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              to={`/evidence?milestoneId=${encodeURIComponent(milestone.data.id)}`}
              className="text-sm font-semibold text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              Upload a new evidence version
            </Link>
            {latestEvidence ? (
              <span className="text-sm text-stone-700">
                Latest recorded comparison:{" "}
                <EvidenceStatus
                  status={latestEvidence.status}
                  verificationStatus={latestEvidence.verificationStatus}
                />
              </span>
            ) : null}
          </div>
        </Card>
      ) : null}
      {milestone.data ? (
        <div>
          <h2 className="mb-3 font-serif text-xl text-stone-900">Evidence</h2>
          <QueryPanel
            status={evidence.status}
            error={evidence.error}
            onRetry={() => void evidence.retry()}
            loadingMessage="Loading milestone evidence..."
            emptyTitle="No evidence uploaded yet."
            emptyDescription="No evidence records were found for this milestone."
          >
            <div className="space-y-6">
              <EvidenceList records={evidenceRecords} />
              <MilestoneEvidenceVersions records={evidenceRecords} />
            </div>
          </QueryPanel>
        </div>
      ) : null}
    </section>
  );
}
