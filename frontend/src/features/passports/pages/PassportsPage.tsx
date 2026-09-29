import { ArrowRight, Building2, ContactRound } from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Card } from "../../../components/ui/Card";
import { QueryPanel } from "../../shared/QueryPanel";
import { useOfficialPassport } from "../hooks/useOfficialPassport";

export function PassportsPage() {
  const official = useOfficialPassport();
  const status = official.status === "success" && official.data?.length === 0 ? "empty" : official.status;

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractor Passports"
        description="Derived project evidence records from the authorized Passport projection. These records are not ratings or assessments."
        icon={ContactRound}
      />
      <QueryPanel
        status={status}
        error={official.error}
        onRetry={() => void official.retry()}
        loadingMessage="Loading contractor passports..."
        emptyTitle="No passport records available."
        emptyDescription="The backend returned no project passport records accessible to this account."
      >
        {official.data ? (
          <div className="space-y-4">
            {official.data.map(({ contractor, project, milestones, blockchainProofs }) => (
              <Card key={project.id} icon={Building2}>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{contractor.legalName}</p>
                    <h2 className="mt-1 font-serif text-xl text-stone-900">{project.name}</h2>
                    <p className="mt-2 break-all font-mono text-xs text-stone-500">Project ID: {project.id}</p>
                    <p className="mt-1 text-sm text-stone-600">
                      {project.contractStatus ?? "Contract status not provided"}
                      {project.procuringEntity ? ` · ${project.procuringEntity}` : ""}
                    </p>
                  </div>
                  <Link
                    to={`/passports/${encodeURIComponent(project.id)}`}
                    className="inline-flex shrink-0 items-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                  >
                    Open passport <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Milestones</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{milestones.length}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence records</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
                      {milestones.reduce((count, milestone) => count + milestone.evidence.length, 0)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Blockchain proof events</dt>
                    <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{blockchainProofs.length}</dd>
                  </div>
                </dl>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState title="Passport records unavailable." description="The backend did not return a usable passport projection." />
        )}
      </QueryPanel>
    </section>
  );
}