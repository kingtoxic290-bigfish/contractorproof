import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { EvidenceList } from "../../evidence/components/EvidenceList";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import { QueryPanel } from "../../shared/QueryPanel";
import { RecordFields } from "../../shared/RecordFields";
import { useMilestone } from "../hooks/useMilestone";

export function MilestoneDetailPage() {
  const { milestoneId } = useParams();
  const milestone = useMilestone(milestoneId);
  const evidence = useEvidence(
    milestone.data?.id,
    undefined,
    milestone.status === "success" && Boolean(milestone.data),
  );

  return (
    <section className="space-y-6">
      <PageHeader
        title="Milestone"
        description="Milestone details are loaded from the existing authenticated milestone endpoint."
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
          <Card title={milestone.data.name}>
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
        <div>
          <h2 className="mb-3 font-serif text-xl text-stone-900">Evidence</h2>
          <QueryPanel
            status={evidence.status}
            error={evidence.error}
            onRetry={() => void evidence.retry()}
            loadingMessage="Loading milestone evidence..."
            emptyTitle="No evidence uploaded yet."
            emptyDescription="The API returned no evidence records for this milestone."
          >
            <EvidenceList records={evidence.records} />
          </QueryPanel>
        </div>
      ) : null}
    </section>
  );
}
