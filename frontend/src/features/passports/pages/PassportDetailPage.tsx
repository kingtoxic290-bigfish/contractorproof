import { ArrowLeft, ContactRound } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { PassportTimeline } from "../components/PassportTimeline";
import { ProjectHistoryCard } from "../components/ProjectHistoryCard";
import { useOfficialProjectPassport } from "../hooks/useOfficialProjectPassport";

export function PassportDetailPage() {
  const { projectId } = useParams();
  const passport = useOfficialProjectPassport(projectId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractor Passport"
        description="A derived record of contractor, project, evidence, verification, proof, and related history returned by the backend."
        icon={ContactRound}
      />
      <Link
        to="/passports"
        className="inline-flex items-center gap-2 text-sm font-semibold text-teal-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to passports
      </Link>

      <QueryPanel
        status={passport.status}
        error={passport.error}
        onRetry={() => void passport.retry()}
        loadingMessage="Loading contractor passport..."
      >
        {passport.data ? (
          <div className="space-y-6">
            <Card title="Contractor" description="Identity and registration fields included in this Passport projection." icon={ContactRound}>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Legal name</dt>
                  <dd className="mt-1 break-words text-sm font-semibold text-stone-900">{passport.data.contractor.legalName}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-stone-500">Contractor ID</dt>
                  <dd className="mt-1 break-all font-mono text-xs text-stone-900">{passport.data.contractor.id}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB registration</dt>
                  <dd className="mt-1 break-words text-sm text-stone-900">{passport.data.contractor.crbRegistrationNumber ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB category / type / class</dt>
                  <dd className="mt-1 text-sm text-stone-900">
                    {[passport.data.contractor.crbCategory, passport.data.contractor.crbType, passport.data.contractor.crbClass]
                      .filter((value): value is string => value !== null).join(" / ") || "Not provided"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB status</dt>
                  <dd className="mt-1 text-sm text-stone-900">{passport.data.contractor.crbStatus ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB last verified</dt>
                  <dd className="mt-1 text-sm text-stone-900">{passport.data.contractor.crbLastVerifiedAt ?? "Not provided"}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-wide text-stone-500">CRB source</dt>
                  <dd className="mt-1 text-sm text-stone-900">{passport.data.contractor.crbSource ?? "Not provided"}</dd>
                </div>
              </dl>
            </Card>

            <ProjectHistoryCard passport={passport.data} />
            <PassportTimeline passport={passport.data} />
          </div>
        ) : null}
      </QueryPanel>
    </section>
  );
}