import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { PassportTimeline } from "../components/PassportTimeline";
import { ProjectHistoryCard } from "../components/ProjectHistoryCard";
import { UnavailableModule } from "../components/UnavailableModule";
import { useContractorHistory } from "../hooks/useContractorHistory";
import { buildTimeline } from "../types";

export function PassportDetailPage() {
  const { contractorId } = useParams();
  const { status, data, error, retry } = useContractorHistory(contractorId);
  const timeline = data ? buildTimeline(data) : [];

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractor project history"
        description="History is assembled from GET /contractors/:id, GET /projects, GET /projects/:projectId/milestones, and GET /evidence. GET /passports/:projectId is not implemented. This is not a contractor score."
      />
      <p>
        <Link
          to="/passports"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to passports
        </Link>
      </p>

      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading project history..."
      >
        {data ? (
          <div className="space-y-6">
            <Card title={data.contractor.legalName}>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Account</dt>
                  <dd className="mt-1 text-sm text-stone-900">{data.contractor.user.fullName}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB registration</dt>
                  <dd className="mt-1 text-sm text-stone-900">
                    {data.contractor.crbRegistrationNumber ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB status</dt>
                  <dd className="mt-1 text-sm text-stone-900">
                    {data.contractor.crbStatus ?? "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Record created</dt>
                  <dd className="mt-1 text-sm text-stone-900">{data.contractor.createdAt}</dd>
                </div>
              </dl>
              <p className="mt-3">
                <Link
                  to={`/contractors/${encodeURIComponent(data.contractor.id)}`}
                  className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  Open contractor record
                </Link>
              </p>
            </Card>

            <UnavailableModule
              title="Official passport projection"
              endpoint="GET /api/v1/passports/:projectId"
            >
              GET /api/v1/passports/:projectId is not implemented (501). This page does not invent a
              passport document, trust score, or blockchain confirmation.
            </UnavailableModule>

            <PassportTimeline events={timeline} />

            {data.projects.length === 0 ? (
              <Card title="Projects">
                <p className="text-sm text-stone-600">
                  GET /api/v1/projects returned no projects with this contractorId.
                </p>
              </Card>
            ) : (
              data.projects.map((entry) => <ProjectHistoryCard key={entry.project.id} entry={entry} />)
            )}
          </div>
        ) : null}
      </QueryPanel>
    </section>
  );
}
