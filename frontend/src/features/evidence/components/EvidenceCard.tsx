import { Link } from "react-router-dom";
import { FileCheck2, History, ShieldCheck } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { CopyButton } from "../../../components/ui/CopyButton";
import { Field, FieldGrid, HashValue } from "../../../components/ui/Field";
import { formatDateTime } from "../../../utils/format";
import { formatFileSize } from "../validation";
import type { PublicEvidence } from "../types";
import { EvidenceStatus } from "./EvidenceStatus";

/**
 * Presents one evidence record as an auditable record.
 *
 * Every value shown here is returned by the API. The card presents the evidence
 * identity, its SHA-256 fingerprint, the current version, the verification and
 * workflow states, and the milestone it belongs to. It deliberately shows no
 * storage path and no internal file-system detail, and it does not describe a
 * record as immutable merely because a hash exists.
 */
export function EvidenceCard({
  record,
  projectId,
}: {
  record: PublicEvidence;
  projectId?: string;
}) {
  const version = record.currentVersion;
  const created = formatDateTime(record.createdAt);
  const updated = formatDateTime(record.updatedAt);
  const versionCreated = version ? formatDateTime(version.createdAt) : null;
  const reviewParams = new URLSearchParams({ evidenceId: record.id, milestoneId: record.milestoneId });
  if (projectId) {
    reviewParams.set("projectId", projectId);
  }
  if (record.currentVersionId) {
    reviewParams.set("evidenceVersionId", record.currentVersionId);
  }

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h3 className="break-words text-base font-semibold text-stone-900">{record.fileName}</h3>
            <p className="mt-1 text-sm text-stone-600">Evidence record</p>
          </div>
          <EvidenceStatus status={record.status} verificationStatus={record.verificationStatus} />
        </div>

        <FieldGrid>
          <Field label="Evidence ID" mono>
            {record.id}
          </Field>
          <Field label="Milestone ID" mono>
            {record.milestoneId}
          </Field>
          <Field label="Content type" className="sm:col-span-2">
            {record.mimeType} · {formatFileSize(record.sizeBytes)}
          </Field>
          <Field label="Recorded">{created ?? "Not recorded"}</Field>
          <Field label="Last updated">{updated ?? "Not recorded"}</Field>
        </FieldGrid>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
                SHA-256 fingerprint
              </p>
              <div className="mt-1">
                <HashValue value={record.sha256} />
              </div>
            </div>
            <CopyButton value={record.sha256} label="Copy SHA-256" className="shrink-0" />
          </div>
          <p className="mt-2 text-xs leading-5 text-stone-600">
            A SHA-256 fingerprint identifies file content. It shows whether bytes are identical; it
            does not establish that a claim in the document is accurate.
          </p>
        </div>

        <section aria-labelledby={`evidence-version-${record.id}`}>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4
              id={`evidence-version-${record.id}`}
              className="text-sm font-semibold text-stone-900"
            >
              {version ? `Version ${version.versionNumber}` : "Version"}
            </h4>
            {version ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#166534] bg-[#dcfce7] px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-[#166534]">
                Current version
              </span>
            ) : null}
          </div>
          {version ? (
            <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
              <FieldGrid>
                <Field label="Version ID" mono>
                  {version.id}
                </Field>
                <Field label="Version created">{versionCreated ?? "Not recorded"}</Field>
                <Field label="Version file" className="sm:col-span-2">
                  {version.fileName}
                </Field>
                <Field label="Version file details" className="sm:col-span-2">
                  {version.mimeType} · {formatFileSize(version.sizeBytes)}
                </Field>
              </FieldGrid>
            </div>
          ) : (
            <p className="text-sm text-stone-600">
              No current version metadata was returned for this evidence record.
            </p>
          )}
        </section>

        <nav aria-label="Evidence record links" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link
            to={`/milestones/${encodeURIComponent(record.milestoneId)}`}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          >
            <History className="h-4 w-4" aria-hidden="true" />
            Milestone this evidence belongs to
          </Link>
          <Link
            to={`/verification?${reviewParams.toString()}`}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          >
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Review verification for this evidence
          </Link>
          <Link
            to={`/evidence?milestoneId=${encodeURIComponent(record.milestoneId)}`}
            className="inline-flex items-center gap-1.5 font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          >
            <FileCheck2 className="h-4 w-4" aria-hidden="true" />
            All evidence for this milestone
          </Link>
        </nav>
      </div>
    </Card>
  );
}