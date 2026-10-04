import { ArrowLeft, ContactRound } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { useAuth } from "../../../hooks/useAuth";
import { formatDateTime } from "../../../utils/format";
import { SelectContractorPanel } from "../components/SelectContractorPanel";
import { useContractorPassport, useOwnContractorPassport } from "../hooks/useContractorPassport";
import type { Counters, ContractorPassport, ContractorPassportProject } from "../types";

const OWN_PASSPORT_PATH = "/contractors/me/passport";

function CountList({ title, counts }: { title: string; counts: Counters }) {
  const entries = Object.entries(counts);
  return (
    <div className="min-w-0">
      <p className="text-xs uppercase tracking-wide text-stone-500">{title}</p>
      {entries.length === 0 ? (
        <p className="mt-1 text-sm text-stone-600">Not provided</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {entries.map(([label, value]) => (
            <li key={label} className="text-sm text-stone-900">
              <span className="font-semibold tabular-nums">{value}</span>{" "}
              <span className="text-stone-600">{label.replace(/_/g, " ").toLowerCase()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PassportIdentity({ passport }: { passport: ContractorPassport }) {
  const { contractor, crbRegistrations } = passport;
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Contractor name</dt>
          <dd className="mt-1 break-words text-sm font-semibold text-stone-900">{contractor.legalName}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">CRB Registration Number</dt>
          <dd className="mt-1 break-words font-mono text-sm text-stone-900">
            {contractor.crbRegistrationNumber ?? "Not provided"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Contractor type</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">{contractor.crbType ?? "Not provided"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Class</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">{contractor.crbClass ?? "Not provided"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Category</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">{contractor.crbCategory ?? "Not provided"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Recorded CRB status</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">{contractor.crbStatus ?? "Not checked"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">CRB check source</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">{contractor.crbSource ?? "Not checked"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">CRB last verified</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">
            {formatDateTime(contractor.crbLastVerifiedAt) ?? "Not checked"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">ContractorProof account</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">
            {contractor.account.role
              ? `${contractor.account.role} · registered ${
                  formatDateTime(contractor.account.registeredAt) ??
                  contractor.account.registeredAt
                }`
              : "Not disclosed"}
          </dd>
        </div>
      </dl>

      <div className="border-t border-stone-200 pt-4">
        <h3 className="text-sm font-semibold text-stone-900">
          CRB registration checks ({crbRegistrations.checkCount})
        </h3>
        <p className="mt-1 text-sm text-stone-600">
          Recorded outcomes of checks run against a CRB source. These are states reported by the
          source, not judgements about the contractor.
        </p>
        {crbRegistrations.history.length === 0 ? (
          <p className="mt-2 text-sm text-stone-600">No CRB check has been recorded.</p>
        ) : (
          <ol className="mt-3 grid gap-2">
            {crbRegistrations.history.map((check) => (
              <li
                key={check.id}
                className="break-words border-b border-stone-100 pb-2 text-sm last:border-0"
              >
                <span className="font-mono text-xs text-stone-900">{check.registrationReference}</span>
                {" · "}
                <span className="font-medium text-stone-900">{check.status}</span>
                {" · "}
<span className="text-stone-600">{check.source}</span>
              {" · "}
              <span className="text-stone-600">
                {formatDateTime(check.checkedAt) ?? check.checkedAt}
              </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

function PassportTotals({ passport }: { passport: ContractorPassport }) {
  const { totals, scope } = passport;
  return (
    <div className="space-y-4">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Projects recorded</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">{totals.projects}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">All milestones verified</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
            {totals.projectsWithAllMilestonesVerified}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">With unverified milestones</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
            {totals.projectsWithUnverifiedMilestones}
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Without milestones</dt>
          <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
            {totals.projectsWithoutMilestones}
          </dd>
        </div>
      </dl>

      {totals.verifiedHistory !== undefined || totals.activeProjects !== undefined ? (
        <dl className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Verified history</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
              {totals.verifiedHistory ?? 0}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Active projects</dt>
            <dd className="mt-1 text-sm font-semibold tabular-nums text-stone-900">
              {totals.activeProjects ?? 0}
            </dd>
          </div>
        </dl>
      ) : null}

      <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-2 lg:grid-cols-3">
        <CountList title="Milestones" counts={totals.milestones} />
        <CountList title="Evidence records" counts={totals.evidence} />
        <CountList title="Client evaluations" counts={totals.attestations} />
        <CountList title="Verification outcomes" counts={totals.verification} />
        <CountList title="Disputes" counts={totals.disputes} />
        <CountList title="Corrections" counts={totals.corrections} />
      </div>

      <div className="grid gap-4 border-t border-stone-200 pt-4 sm:grid-cols-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Blockchain proof events</p>
          <p className="mt-1 text-sm text-stone-900">
            <span className="font-semibold tabular-nums">{totals.blockchainProofs.total}</span>{" "}
            <span className="text-stone-600">
              ({totals.blockchainProofs.confirmed} confirmed, {totals.blockchainProofs.pending} pending)
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Projects with withheld detail</p>
          <p className="mt-1 text-sm tabular-nums text-stone-900">
            {scope.withheldProjectDetailCount}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-stone-500">Passport scope</p>
          <p className="mt-1 text-sm text-stone-900">
            {scope.isOwnPassport ? "Your own passport" : `Viewed as ${scope.viewerRole}`}
          </p>
        </div>
      </div>

      <p className="border-t border-stone-200 pt-4 text-sm text-stone-600">
        {scope.milestoneCompletionBasis} {scope.verifiedHistoryBasis ?? ""} This passport presents
        recorded facts. It contains no rating, score, ranking or recommendation.
      </p>
    </div>
  );
}

function ProjectCard({ project }: { project: ContractorPassportProject }) {
  return (
    <Card>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="break-words font-serif text-lg text-stone-900">{project.name}</h3>
                {/* The project reference is the identifier a client recognises. The
                    project id stays inside the drill-down link. */}
                <p className="mt-1 text-xs text-stone-500">
                  Project reference:{" "}
                  <span className="font-mono">
                    {project.nestContractReference ?? project.ocid ?? "Not provided"}
                  </span>
                </p>
              </div>
              <Link
                to={`/passports/${encodeURIComponent(project.id)}`}
                className="shrink-0 text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Open project Passport
              </Link>
            </div>

            <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Client</dt>
                <dd className="mt-1 break-words text-sm text-stone-900">
                  {project.clientVisible
                    ? (project.clientName ?? "Not provided")
                    : "Withheld — another client's project"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Contract status</dt>
                <dd className="mt-1 break-words text-sm text-stone-900">
                  {project.contractStatus ?? "Not provided"}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Contract dates</dt>
                <dd className="mt-1 break-words text-sm text-stone-900">
                  {project.contractStartDate ?? "Not provided"}
                  {project.contractEndDate ? ` – ${project.contractEndDate}` : ""}
                </dd>
              </div>
            </dl>

            <div className="mt-4 grid gap-3 border-t border-stone-200 pt-4 sm:grid-cols-2">
              <CountList title="Milestone status" counts={project.milestoneStatus.byStatus} />
              <CountList title="Evidence status" counts={project.evidence.byStatus} />
              <CountList title="Client evaluations" counts={project.attestations} />
              <CountList title="Verification outcomes" counts={project.verification} />
              <CountList title="Disputes" counts={project.disputes.byStatus} />
              <CountList title="Corrections" counts={project.corrections.byStatus} />
            </div>

            <div className="mt-4 border-t border-stone-200 pt-4">
              <h4 className="text-sm font-semibold text-stone-900">
                Milestones ({project.milestoneStatus.total})
              </h4>
              {project.milestoneStatus.total === 0 ? (
                <p className="mt-1 text-sm text-stone-600">No milestones are recorded.</p>
              ) : (
                <ul className="mt-2 grid gap-2">
                  {project.milestones.map((milestone) => (
                    <li key={milestone.id} className="min-w-0 break-words text-sm">
                      <span className="font-medium text-stone-900">{milestone.name}</span>
                      {" · "}
                      <span className="text-stone-700">{milestone.status}</span>
                      {" · "}
                      <span className="text-stone-600">
                        {milestone.evidence.total} evidence records
                      </span>
                      {Object.values(milestone.evidence.attestations).some((count) => count > 0) ? (
                        <span className="text-stone-600">
                          {" · "}
                          {milestone.evidence.attestations.APPROVED ?? 0} approved,{" "}
                          {milestone.evidence.attestations.REJECTED ?? 0} rejected evaluations
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
    </Card>
  );
}

function ProjectGroup({
  heading,
  description,
  basis,
  projects,
  emptyMessage,
}: {
  heading: string;
  description: string;
  basis?: string;
  projects: ContractorPassportProject[];
  emptyMessage: string;
}) {
  return (
    <section aria-label={heading} className="space-y-3">
      <div>
        <h3 className="font-serif text-lg text-stone-900">{heading}</h3>
        <p className="mt-1 text-sm text-stone-600">{description}</p>
        {basis ? <p className="mt-1 text-sm text-stone-500">{basis}</p> : null}
      </div>
      {projects.length === 0 ? (
        <p className="text-sm text-stone-600">{emptyMessage}</p>
      ) : (
        <ul className="grid gap-4">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PassportProjects({ passport }: { passport: ContractorPassport }) {
  if (passport.projects.length === 0) {
    return (
      <p className="text-sm text-stone-600">
        No project history has been recorded for this contractor.
      </p>
    );
  }

  const verifiedHistory = passport.verifiedHistory;
  const activeProjects = passport.activeProjects;

  // Without the split from the server there is nothing honest to say about
  // which bucket a project belongs in, so show them together rather than
  // guessing a placement from counts.
  if (!verifiedHistory || !activeProjects) {
    return (
      <ul className="grid gap-4">
        {passport.projects.map((project) => (
          <li key={project.id}>
            <ProjectCard project={project} />
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="grid gap-8">
      <ProjectGroup
        heading="Verified history"
        description="Projects where every milestone has been verified against submitted evidence."
        basis={passport.scope.verifiedHistoryBasis}
        projects={verifiedHistory}
        emptyMessage="No project has had all of its milestones verified yet."
      />
      <ProjectGroup
        heading="Active projects"
        description="Projects that are still in progress, awaiting review, or carrying unverified milestones."
        projects={activeProjects}
        emptyMessage="No project is currently in progress."
      />
    </div>
  );
}

export function ContractorPassportPage() {
  const { contractorId } = useParams();
  const { pathname } = useLocation();
  const { hasRole } = useAuth();
  // "/contractors/me/passport" is a literal route, so it carries no route param.
  const own = contractorId ? false : pathname.endsWith(OWN_PASSPORT_PATH);
  // Both hooks are always called so the rule of hooks holds; only the enabled
  // one issues a request.
  const ownPassport = useOwnContractorPassport(own);
  const selectedPassport = useContractorPassport(own ? undefined : contractorId);
  const passport = own ? ownPassport : selectedPassport;
  const canSelect = hasRole("CLIENT", "ADMIN");

  return (
    <section className="space-y-6">
      <PageHeader
        title={own ? "My Contractor Passport" : "Contractor Passport"}
        description="Recorded identity, registration, project execution and proof history. This passport presents factual history so you can make the decision. It contains no score, rating or recommendation."
        icon={ContactRound}
      />

      <Link
        to={own ? "/projects" : "/contractors"}
        className="inline-flex items-center gap-2 text-sm font-semibold text-teal-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {own ? "Back to my assigned projects" : "Back to contractors"}
      </Link>

      <QueryPanel
        status={passport.status}
        error={passport.error}
        onRetry={() => void passport.retry()}
        loadingMessage="Loading contractor passport..."
      >
        {passport.data ? (
          <div className="space-y-6">
            <Card title="Registration and identity" description="Recorded contractor and CRB registration fields. ContractorProof does not replace CRB registration.">
              <PassportIdentity passport={passport.data} />
            </Card>

            <Card title="Recorded history" description="Counts derived from the projects, milestones, evidence, evaluations and proof events stored for this contractor.">
              <PassportTotals passport={passport.data} />
            </Card>

            <section aria-label="Project history" className="space-y-3">
              <div>
                <h2 className="font-serif text-xl text-stone-900">Project history</h2>
                <p className="mt-1 text-sm text-stone-600">
                  Projects this contractor is recorded against, with milestone and proof outcomes.
                </p>
              </div>
              <PassportProjects passport={passport.data} />
            </section>

            {canSelect && !own ? (
              <Card>
                <SelectContractorPanel
                  contractor={{
                    id: passport.data.contractor.id,
                    legalName: passport.data.contractor.legalName,
                    crbRegistrationNumber: passport.data.contractor.crbRegistrationNumber,
                  }}
                />
              </Card>
            ) : null}
          </div>
        ) : null}
      </QueryPanel>
    </section>
  );
}