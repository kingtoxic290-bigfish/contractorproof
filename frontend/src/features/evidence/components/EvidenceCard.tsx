import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { Button } from "../../../components/ui/Button";
import type { PublicEvidence } from "../types";
import { formatFileSize } from "../validation";
import { EvidenceStatus } from "./EvidenceStatus";

export function EvidenceCard({ record }: { record: PublicEvidence }) {
  const [copyMessage, setCopyMessage] = useState("");
  const version = record.currentVersion;

  async function copySha256() {
    try {
      await navigator.clipboard.writeText(record.sha256);
      setCopyMessage("SHA-256 copied.");
    } catch {
      setCopyMessage("Clipboard access is unavailable; select the full hash to copy it.");
    }
  }

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

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">{record.id}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Milestone ID</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">{record.milestoneId}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Canonical SHA-256</dt>
            <dd className="mt-1 flex min-w-0 flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-stone-900">{record.sha256}</code>
              <Button type="button" variant="secondary" onClick={() => void copySha256()}>
                Copy SHA-256
              </Button>
            </dd>
            <p className="mt-1 text-xs text-stone-600" role="status" aria-live="polite">
              {copyMessage}
            </p>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Created</dt>
            <dd className="mt-1 break-words text-sm text-stone-900">{record.createdAt}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Content type</dt>
            <dd className="mt-1 break-words text-sm text-stone-900">{record.mimeType}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">File size</dt>
            <dd className="mt-1 text-sm text-stone-900">{formatFileSize(record.sizeBytes)}</dd>
          </div>
        </dl>

        {version ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
            <h4 className="text-sm font-medium text-stone-900">Version {version.versionNumber}</h4>
            <dl className="mt-2 grid gap-2 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Version ID</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-800">{version.id}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Version created</dt>
                <dd className="mt-1 break-words text-sm text-stone-800">{version.createdAt}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Version file</dt>
                <dd className="mt-1 break-words text-sm text-stone-800">{version.fileName}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs uppercase tracking-wide text-stone-500">Version file details</dt>
                <dd className="mt-1 break-words text-sm text-stone-800">
                  {version.mimeType} · {formatFileSize(version.sizeBytes)}
                </dd>
              </div>
            </dl>
          </div>
        ) : (
          <p className="text-sm text-stone-600">No current-version metadata was supplied.</p>
        )}

        <div className="flex flex-wrap gap-3">
          <Link
            to={`/evidence?milestoneId=${encodeURIComponent(record.milestoneId)}`}
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Milestone {record.milestoneId}
          </Link>
        </div>
      </div>
    </Card>
  );
}
