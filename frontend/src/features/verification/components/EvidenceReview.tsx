import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { EvidenceStatus } from "../../evidence/components/EvidenceStatus";
import type { PublicEvidence } from "../../evidence/types";
import { formatFileSize } from "../../evidence/validation";

export function EvidenceReview({
  evidence,
  evidenceId,
  evidenceVersionId,
  milestoneId,
  projectId,
}: {
  evidence: PublicEvidence | null;
  evidenceId?: string;
  evidenceVersionId?: string;
  milestoneId?: string;
  projectId?: string;
}) {
  const version = evidence?.currentVersion ?? null;
  const displayedEvidenceId = evidence?.id ?? evidenceId;
  const displayedVersionId = version?.id ?? evidence?.currentVersionId ?? evidenceVersionId;
  const displayedMilestoneId = evidence?.milestoneId ?? milestoneId;
  const fileName = evidence?.fileName;
  const sha256 = evidence?.sha256 ?? version?.sha256;

  return (
    <Card
      title="Evidence being reviewed"
      description="Fingerprint comparison and attestation apply to this evidence record. Review what you are verifying before you take an action."
    >
      {fileName ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="break-words text-base font-medium text-stone-900">{fileName}</h3>
            {evidence ? (
              <p className="mt-1 text-sm text-stone-600">
                {evidence.mimeType} · {formatFileSize(evidence.sizeBytes)}
              </p>
            ) : null}
          </div>
          {evidence ? (
            <EvidenceStatus status={evidence.status} verificationStatus={evidence.verificationStatus} />
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-stone-600">
          Select an evidence record from the list above, or provide identifiers directly. Filename and fingerprint will appear when the evidence list includes this record.
        </p>
      )}

      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">
            {displayedEvidenceId ?? "Not provided"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence version</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">
            {displayedVersionId ?? "Current version (server-resolved)"}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Milestone</dt>
          <dd className="mt-1 break-all text-sm text-stone-900">
            {displayedMilestoneId ? (
              <Link
                to={`/evidence?milestoneId=${encodeURIComponent(displayedMilestoneId)}`}
                className="font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                {displayedMilestoneId}
              </Link>
            ) : (
              "Not provided"
            )}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Project</dt>
          <dd className="mt-1 break-all text-sm text-stone-900">
            {projectId ? (
              <Link
                to={`/projects/${encodeURIComponent(projectId)}`}
                className="font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                {projectId}
              </Link>
            ) : (
              "Not provided"
            )}
          </dd>
        </div>
        <div className="min-w-0 sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence fingerprint</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">
            {sha256 ?? "Not provided"}
          </dd>
        </div>
      </dl>

      {evidence ? (
        <p className="mt-4 text-sm text-stone-600">
          Evidence workflow status: <span className="font-medium">{evidence.status}</span>.
          Verification state: <span className="font-medium">{evidence.verificationStatus}</span>.
          The SHA-256 fingerprint shown above is the recorded value; it is not a verification decision.
        </p>
      ) : null}
    </Card>
  );
}
