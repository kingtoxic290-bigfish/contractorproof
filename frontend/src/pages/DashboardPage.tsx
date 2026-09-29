import { useEffect, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Clock3,
  FileCheck2,
  Flag,
  Link2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { ApiError } from "../services/api/errors";
import { loadDashboard } from "./dashboardApi";
import {
  formatDashboardDate,
  getDashboardAttention,
  getDashboardSummary,
  getRecentActivity,
} from "./dashboard.utils";
import {
  VERIFICATION_STATES,
  type DashboardProjectPassport,
  type VerificationState,
} from "./dashboard.types";

type DashboardState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; passports: DashboardProjectPassport[] };

function dashboardErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your sign-in session has expired. Sign in again to load dashboard records.";
    }
    if (error.status === 403) {
      return "You are signed in, but the backend did not authorize access to these dashboard records.";
    }
    if (error.status === 404) {
      return "The dashboard records were not found by the backend.";
    }
    if (error.status >= 500) {
      return "The ContractorProof service could not load dashboard records. Please try again.";
    }
  }
  if (error instanceof TypeError) {
    return "We couldn't reach the ContractorProof service. Check the connection and try again.";
  }
  return "Dashboard records are currently unavailable. Please try again.";
}

function CountCard({ title, count, icon: Icon }: { title: string; count: number; icon: LucideIcon }) {
  return (
    <Card icon={Icon}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{title}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
            {new Intl.NumberFormat().format(count)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function VerificationCount({ status, count }: { status: VerificationState; count: number }) {
  const config = {
    MATCH: { tone: "border-green-800 bg-green-50 text-green-900", icon: BadgeCheck },
    MISMATCH: { tone: "border-red-800 bg-red-50 text-red-900", icon: AlertTriangle },
    PENDING: { tone: "border-amber-800 bg-amber-50 text-amber-950", icon: Clock3 },
    UNAVAILABLE: { tone: "border-stone-500 bg-stone-100 text-stone-800", icon: ShieldCheck },
  }[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between gap-4 border-b border-stone-200 py-3 last:border-b-0">
      <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold ${config.tone}`}>
        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
        <span>{status}</span>
      </span>
      <span className="font-semibold tabular-nums text-stone-900">
        {new Intl.NumberFormat().format(count)}
      </span>
    </div>
  );
}

export function DashboardPage() {
  const [state, setState] = useState<DashboardState>({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    loadDashboard()
      .then((passports) => {
        if (active) setState({ status: "loaded", passports });
      })
      .catch((error: unknown) => {
        if (active) setState({ status: "error", message: dashboardErrorMessage(error) });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <section>
      <PageHeader
        title="Verification Dashboard"
        description="Evidence, verification and proof activity across accessible projects."
      />

      {state.status === "loading" ? <LoadingState message="Loading project evidence and verification records..." /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : null}
      {state.status === "loaded" ? <DashboardContent passports={state.passports} /> : null}
    </section>
  );
}

function DashboardContent({ passports }: { passports: DashboardProjectPassport[] }) {
  const summary = getDashboardSummary(passports);
  const activities = getRecentActivity(passports);
  const attention = getDashboardAttention(passports);

  return (
    <div className="space-y-6">
      <section aria-label="Record totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <CountCard title="Projects" count={summary.projectCount} icon={Building2} />
        <CountCard title="Milestones" count={summary.milestoneCount} icon={Flag} />
        <CountCard title="Evidence" count={summary.evidenceCount} icon={FileCheck2} />
        <CountCard title="Verification" count={summary.verificationCount} icon={ShieldCheck} />
        <CountCard title="Attestations" count={summary.attestations.length} icon={BadgeCheck} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2" aria-label="Verification and proof overview">
        <Card title="Verification overview" description="Persisted verification results, by recorded state." icon={ShieldCheck}>
          {VERIFICATION_STATES.map((status) => (
            <VerificationCount key={status} status={status} count={summary.verificationCounts[status]} />
          ))}
        </Card>

        <Card title="Blockchain proof" description="Proof events establish the integrity layer only." icon={Link2}>
          <dl className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-sm text-stone-600">Confirmed</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {summary.confirmedProofCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-600">Pending</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {summary.pendingProofCount}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-stone-600">Projects with no proof events</dt>
              <dd className="mt-1 text-2xl font-semibold tabular-nums text-stone-900">
                {summary.projectsWithoutProof}
              </dd>
            </div>
          </dl>
          {passports.length === 0 ? (
            <p className="mt-4 text-sm text-stone-600">No project proof records are available.</p>
          ) : null}
        </Card>
      </section>

      <Card title="Items requiring attention" description="Factual verification states only; no intent is inferred." icon={AlertTriangle}>
        {attention.length === 0 ? (
          <EmptyState title="No attention items." description="No MISMATCH, PENDING or UNAVAILABLE verification results were returned." />
        ) : (
          <ul className="divide-y divide-stone-200">
            {attention.map((item) => {
              const project = passports.find((entry) => entry.project.id === item.projectId)?.project;
              return (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                  <div>
                    <p className="font-medium text-stone-900">{item.status} detected</p>
                    <p className="mt-1 text-sm text-stone-600">
                      Evidence {item.evidenceId}{project ? ` · ${project.name}` : ""}
                    </p>
                  </div>
                  <Link className="text-sm font-semibold text-[#0f3d3a] underline underline-offset-4" to={`/projects/${item.projectId}`}>
                    Open project
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Card title="Projects" description="Project records returned within your backend-authorized scope." icon={Building2}>
        {passports.length === 0 ? (
          <EmptyState title="No projects available." description="The backend returned no projects accessible to this account." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <caption className="sr-only">Accessible projects, associated milestones, evidence and proof state</caption>
              <thead>
                <tr className="border-b border-stone-300 text-xs uppercase text-stone-600">
                  <th scope="col" className="px-3 py-3 font-semibold">Project</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Contractor</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Status</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Milestones</th>
                  <th scope="col" className="px-3 py-3 text-right font-semibold">Evidence</th>
                  <th scope="col" className="px-3 py-3 font-semibold">Proof</th>
                </tr>
              </thead>
              <tbody>
                {passports.map((passport) => {
                  const evidenceCount = passport.milestones.reduce(
                    (count, milestone) => count + milestone.evidence.length,
                    0,
                  );
                  const confirmed = passport.blockchainProofs.some((proof) => proof.confirmed);
                  const proofLabel = confirmed
                    ? "Confirmed"
                    : passport.blockchainProofs.length > 0
                      ? "Pending"
                      : "No proof";
                  return (
                    <tr key={passport.project.id} className="border-b border-stone-200 last:border-b-0">
                      <th scope="row" className="px-3 py-4 font-medium">
                        <Link className="text-[#0f3d3a] underline underline-offset-4" to={`/projects/${passport.project.id}`}>
                          {passport.project.name}
                        </Link>
                        <span className="mt-1 block break-all font-mono text-xs font-normal text-stone-500">
                          {passport.project.id}
                        </span>
                      </th>
                      <td className="px-3 py-4 text-stone-700">{passport.contractor.legalName}</td>
                      <td className="px-3 py-4 text-stone-700">{passport.project.contractStatus ?? "Not supplied"}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{passport.milestones.length}</td>
                      <td className="px-3 py-4 text-right tabular-nums">{evidenceCount}</td>
                      <td className="px-3 py-4 text-stone-700">{proofLabel}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Recent activity" description="Chronological records returned by the project passport projection." icon={Clock3}>
        {activities.length === 0 ? (
          <EmptyState title="No recent activity available." description="No timestamped project, milestone, evidence, verification, attestation or proof records were returned." />
        ) : (
          <ol className="divide-y divide-stone-200">
            {activities.map((activity) => (
              <li key={activity.id} className="flex flex-col gap-1 py-3 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div>
                  <p className="font-medium text-stone-900">{activity.label}</p>
                  <p className="mt-1 text-sm text-stone-600">{activity.detail}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-sm">
                  <time dateTime={activity.at} className="text-stone-600">{formatDashboardDate(activity.at)}</time>
                  <Link className="font-semibold text-[#0f3d3a] underline underline-offset-4" to={`/projects/${activity.projectId}`}>
                    Project
                  </Link>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}