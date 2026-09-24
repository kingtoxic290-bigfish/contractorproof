import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { EvidenceStatus } from "../../evidence/components/EvidenceStatus";
import { StateLabel } from "../../shared/StateLabel";
import type { ProjectHistory } from "../types";
import { IntegrityNote } from "./IntegrityNote";
import { UnavailableModule } from "./UnavailableModule";

export function ProjectHistoryCard({ entry }: { entry: ProjectHistory }) {
  const { project, milestones, evidence } = entry;

  return (
    <Card title={project.name} description={project.description ?? undefined}>
      <dl className="grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Contract status</dt>
          <dd className="mt-1 text-sm text-stone-900">{project.contractStatus ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Procuring entity</dt>
          <dd className="mt-1 text-sm text-stone-900">{project.procuringEntity ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">NeST tender</dt>
          <dd className="mt-1 text-sm text-stone-900">{project.nestTenderReference ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">NeST contract</dt>
          <dd className="mt-1 text-sm text-stone-900">{project.nestContractReference ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">OCID</dt>
          <dd className="mt-1 text-sm text-stone-900">{project.ocid ?? "Not provided"}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Contract dates</dt>
          <dd className="mt-1 text-sm text-stone-900">
            {project.contractStartDate ?? "Not provided"} — {project.contractEndDate ?? "Not provided"}
          </dd>
        </div>
      </dl>

      <p className="mt-3">
        <Link
          to={`/projects/${encodeURIComponent(project.id)}`}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Open project record
        </Link>
      </p>

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-medium text-stone-900">Milestones</h3>
        {milestones.length === 0 ? (
          <p className="text-sm text-stone-600">GET /projects/:projectId/milestones returned no milestones.</p>
        ) : (
          <ul className="space-y-2">
            {milestones.map((milestone) => (
              <li key={milestone.id} className="rounded-md border border-stone-200 px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-stone-900">{milestone.name}</p>
                  <StateLabel value={milestone.status} />
                </div>
                <p className="mt-1 text-sm text-stone-600">Recorded {milestone.createdAt}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 space-y-3">
        <h3 className="text-sm font-medium text-stone-900">Evidence</h3>
        {evidence.length === 0 ? (
          <p className="text-sm text-stone-600">GET /evidence?projectId= returned no evidence.</p>
        ) : (
          <ul className="space-y-3">
            {evidence.map((record) => (
              <li key={record.id} className="rounded-md border border-stone-200 px-3 py-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-stone-900">{record.fileName}</p>
                    <p className="mt-1 break-all font-mono text-xs text-stone-700">{record.sha256}</p>
                    {record.currentVersion ? (
                      <p className="mt-1 text-sm text-stone-600">
                        Version {record.currentVersion.versionNumber}
                      </p>
                    ) : null}
                  </div>
                  <EvidenceStatus status={record.status} verificationStatus={record.verificationStatus} />
                </div>
                <div className="mt-3">
                  <p className="text-xs uppercase tracking-wide text-stone-500">Fingerprint compare</p>
                  <IntegrityNote status={record.verificationStatus} />
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  This compare field is returned by GET /evidence. It is not a POST /verification
                  decision and is not a passport score.
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-5 grid gap-3">
        <UnavailableModule
          title="Attestations"
          endpoint="GET /api/v1/attestations"
        >
          GET /api/v1/attestations is not implemented (501). APPROVED and REJECTED decisions are
          not listed here.
        </UnavailableModule>
        <UnavailableModule title="Blockchain proof" endpoint="GET /api/v1/blockchain">
          GET /api/v1/blockchain is not implemented (501) and is restricted to ADMIN and AUDITOR.
          No transaction, network, or anchor is shown.
        </UnavailableModule>
      </div>
    </Card>
  );
}
