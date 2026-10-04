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
        title="Project Passport"
        description="A record of one project: contractor identity, milestones, evidence, verification outcomes, attestations, and blockchain proof events."
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
            <Card title="REGULATORY · CRB" description="Registration information returned from the CRB source. This is separate from procurement history." icon={ContactRound}>
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

            <section aria-label="NeST procurement records" className="space-y-3">
              <div>
                <h2 className="font-serif text-xl text-stone-900">PROCUREMENT · NeST</h2>
                <p className="mt-1 text-sm text-stone-600">Procurement information sourced from NeST. A tender, award, or contract is not a contractor verification or performance assessment.</p>
              </div>
              {passport.data.contractor.procurementRecords.length === 0 ? (
                <Card><p className="text-sm text-stone-600">No procurement records have been explicitly linked to this contractor.</p></Card>
              ) : passport.data.contractor.procurementRecords.map((record) => (
                <Card key={`${record.sourceSystem}:${record.externalReference}`}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{record.sourceSystem === "SANDBOX_DEMO" ? "DEMO / SANDBOX" : "NeST / PPRA · Public OCDS"}</p>
                  <p className="mt-1 break-all font-mono text-xs text-stone-600">OCID {record.externalReference}</p>
                  {record.sourceRecordId ? <p className="mt-1 text-xs text-stone-600">Source record: {record.sourceRecordId}</p> : null}
                  <p className="mt-1 break-all text-xs text-stone-600">Source: {record.sourceReference}</p>
                  <p className="mt-1 text-xs text-stone-600">Linked {record.linkedAt}</p>
                  <ol className="mt-3 space-y-3 border-t border-stone-200 pt-3">
                    {record.observations.map((observation) => (
                      <li key={observation.id} className="border-b border-stone-100 pb-3 last:border-0 last:pb-0">
                        <p className="font-medium text-stone-900">{observation.title ?? observation.tenderReference ?? "Procurement release"}</p>
                        <p className="mt-1 text-xs text-stone-600">Release {observation.releaseId} · Retrieved {observation.retrievedAt}</p>
                        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                          <div><dt className="text-xs uppercase text-stone-500">Buyer</dt><dd className="text-stone-800">{observation.buyerName ?? "Not published"}</dd></div>
                          <div><dt className="text-xs uppercase text-stone-500">Tender stage</dt><dd className="text-stone-800">{observation.tenderStatus ?? "Unknown"}</dd></div>
                          <div><dt className="text-xs uppercase text-stone-500">Award</dt><dd className="text-stone-800">{observation.awardStatus ?? "Not published"}</dd></div>
                          <div><dt className="text-xs uppercase text-stone-500">Contract</dt><dd className="text-stone-800">{observation.contractReference ?? "Not published"}{observation.contractStatus ? ` · ${observation.contractStatus}` : ""}</dd></div>
                          <div><dt className="text-xs uppercase text-stone-500">Published contractor name</dt><dd className="text-stone-800">{observation.contractorName ?? "Not published"}</dd></div>
                          <div><dt className="text-xs uppercase text-stone-500">Contract value</dt><dd className="text-stone-800">{observation.contractValue ? `${observation.contractValue} ${observation.contractCurrency ?? ""}`.trim() : "Not published"}</dd></div>
                        </dl>
                        <p className="mt-2 break-all font-mono text-[0.7rem] text-stone-500">Source digest · {observation.sourceDigest}</p>
                      </li>
                    ))}
                  </ol>
                </Card>
              ))}
            </section>

            <ProjectHistoryCard passport={passport.data} />
            <PassportTimeline passport={passport.data} />
          </div>
        ) : null}
      </QueryPanel>
    </section>
  );
}