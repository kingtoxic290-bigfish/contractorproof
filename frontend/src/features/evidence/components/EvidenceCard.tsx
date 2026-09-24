import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { useAuth } from "../../../hooks/useAuth";
import { VERIFY_INTERNAL_ROLES } from "../../verification/types";
import type { PublicEvidence } from "../types";
import { formatFileSize } from "../validation";
import { EvidenceStatus } from "./EvidenceStatus";

export function EvidenceCard({ record }: { record: PublicEvidence }) {
  const { hasRole } = useAuth();
  const canReview = hasRole(...VERIFY_INTERNAL_ROLES);
  const version = record.currentVersion;

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="break-words text-base font-medium text-stone-900">{record.fileName}</h3>
            <p className="mt-1 text-sm text-stone-600">
              {record.mimeType} · {formatFileSize(record.sizeBytes)}
            </p>
          </div>
          <EvidenceStatus status={record.status} verificationStatus={record.verificationStatus} />
        </div>

        <p className="text-sm text-stone-600">
          A successful upload is not a verification. Workflow status and fingerprint comparison are
          separate.
        </p>

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence fingerprint</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">{record.sha256}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">SHA-256</dt>
            <dd className="mt-1 text-sm text-stone-700">
              This fingerprint uniquely represents the uploaded evidence file. It can later be
              compared to detect changes.
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Current version</dt>
            <dd className="mt-1 text-sm text-stone-900">
              {version ? `Version ${version.versionNumber}` : "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Uploaded</dt>
            <dd className="mt-1 text-sm text-stone-900">{record.createdAt}</dd>
          </div>
        </dl>

        {version ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
            <h4 className="text-sm font-medium text-stone-900">Version {version.versionNumber}</h4>
            <p className="mt-1 text-sm text-stone-600">
              {version.fileName} · uploaded {version.createdAt}
            </p>
            <p className="mt-2 break-all font-mono text-xs text-stone-800">SHA-256 {version.sha256}</p>
            <p className="mt-2 text-xs text-stone-500">
              The evidence list returns the current version only. Earlier versions are not listed by
              this API.
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Link
            to={`/evidence?milestoneId=${encodeURIComponent(record.milestoneId)}`}
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Milestone {record.milestoneId}
          </Link>
          {canReview ? (
            <Link
              to={`/verification?evidenceId=${encodeURIComponent(record.id)}&milestoneId=${encodeURIComponent(record.milestoneId)}${
                record.currentVersionId
                  ? `&evidenceVersionId=${encodeURIComponent(record.currentVersionId)}`
                  : ""
              }`}
              className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              Review for verification
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
