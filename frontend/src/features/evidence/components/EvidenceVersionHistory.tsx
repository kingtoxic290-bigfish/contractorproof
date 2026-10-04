import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { CopyButton } from "../../../components/ui/CopyButton";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { formatDateTime } from "../../../utils/format";
import { queryErrorMessage } from "../../shared/query";
import { listVerificationHistory, type VerificationHistoryEntry } from "../../verification/api/verificationHistoryApi";
import { VerificationStatus } from "../../verification/components/VerificationStatus";
import type { PublicEvidence } from "../types";

/**
 * Evidence versions recorded for one evidence record.
 *
 * The evidence list endpoint returns the current version only, so the version
 * sequence is read from the stored verification records, which reference the
 * exact evidence version they compared. Every version the server has recorded a
 * verification for is listed: a superseded version stays visible as history and is
 * never replaced by the version that follows it.
 *
 * Nothing here is inferred. If the server returned no verification for a version,
 * that version is simply not listed, and the absence of history is stated rather
 * than being filled in.
 */
function groupByVersion(entries: VerificationHistoryEntry[], evidenceId: string) {
  const matching = entries.filter((entry) => entry.evidenceId === evidenceId);
  const versions = new Map<
    string,
    {
      versionId: string;
      versionNumber: number;
      sha256: string;
      results: Array<{ id: string; status: string; source: string; createdAt: string }>;
    }
  >();

  for (const entry of matching) {
    const result = {
      id: entry.verification.id,
      status: entry.verification.status,
      source: entry.verification.source,
      createdAt: entry.verification.createdAt,
    };
    const existing = versions.get(entry.evidenceVersionId);
    if (existing) {
      existing.results.push(result);
      continue;
    }
    versions.set(entry.evidenceVersionId, {
      versionId: entry.evidenceVersionId,
      versionNumber: entry.versionNumber,
      sha256: entry.sha256,
      results: [result],
    });
  }

  return [...versions.values()]
    .map((version) => ({
      ...version,
      results: [...version.results].sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    }))
    .sort((left, right) => left.versionNumber - right.versionNumber);
}

export function EvidenceVersionHistory({ evidence }: { evidence: PublicEvidence }) {
  const [entries, setEntries] = useState<VerificationHistoryEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    setError(null);
    void listVerificationHistory()
      .then((history) => {
        if (!active) return;
        setEntries(history);
        setStatus("success");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus("failed");
        setError(
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : queryErrorMessage(cause),
        );
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const versions = useMemo(
    () => (status === "success" ? groupByVersion(entries, evidence.id) : []),
    [entries, evidence.id, status],
  );
  const currentVersionNumber = evidence.currentVersion?.versionNumber ?? null;

  if (status === "idle") {
    return null;
  }

  return (
    <section aria-label={`Evidence versions for ${evidence.fileName}`} className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <History className="h-4 w-4" aria-hidden="true" /> Evidence versions
      </h3>

      {status === "loading" ? (
        <p className="text-sm text-stone-600">Loading recorded evidence versions...</p>
      ) : null}

      {status === "failed" ? (
        <ErrorState
          message={
            error ?? "The recorded evidence versions could not be loaded. This does not mean they are absent."
          }
          onRetry={() => setReloadKey((key) => key + 1)}
        />
      ) : null}

      {status === "success" ? (
        versions.length === 0 ? (
          <p className="text-sm text-stone-600">
            No verification has been recorded for any version of this evidence yet. Version{" "}
            {currentVersionNumber !== null ? currentVersionNumber : ""} is recorded as the current
            version and is awaiting a result.
          </p>
        ) : (
          <>
            <p className="text-sm text-stone-600">
              Each version is kept as recorded. A version with an earlier result stays visible as
              history; it is not replaced by a later version.
            </p>
            <ol className="grid gap-3">
              {versions.map((version) => {
                const latest =
                  currentVersionNumber !== null && version.versionNumber === currentVersionNumber;
                const first = version.results[0];
                return (
                  <li
                    key={version.versionId}
                    className={
                      latest
                        ? "rounded-lg border border-stone-300 bg-white p-3"
                        : "rounded-lg border border-stone-200 bg-stone-50 p-3"
                    }
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-stone-900">
                        Version {version.versionNumber}
                      </span>
                      <span className="text-xs text-stone-500">
                        {latest ? "Latest version" : "Superseded version"}
                      </span>
                      <VerificationStatus status={first.status} />
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      Recorded {formatDateTime(first.createdAt) ?? first.createdAt} ·{" "}
                      {first.source}
                    </p>
                    <div className="mt-2 flex items-start gap-2">
                      <code className="min-w-0 flex-1 break-all font-mono text-[0.7rem] text-stone-700">
                        SHA-256 {version.sha256}
                      </code>
                      <CopyButton value={version.sha256} label="Copy SHA-256" />
                    </div>
                    {version.results.length > 1 ? (
                      <p className="mt-2 text-xs text-stone-600">
                        {version.results.length} verification records for this version; the first
                        recorded result is shown.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </>
        )
      ) : null}
    </section>
  );
}

/**
 * Version history for every evidence record on a milestone.
 *
 * Rendered next to the current-version card so the executed sequence
 * (V1 mismatch, rework, V2 match) is readable in one place.
 */
export function MilestoneEvidenceVersions({ records }: { records: PublicEvidence[] }) {
  if (records.length === 0) {
    return null;
  }

  return (
    <Card
      title="Recorded evidence versions"
      description="Every evidence version the server recorded a verification result for, with its version number, fingerprint and result. Earlier versions remain visible after a new version is uploaded."
    >
      <div className="space-y-5">
        {records.map((record) => (
          <EvidenceVersionHistory key={record.id} evidence={record} />
        ))}
      </div>
    </Card>
  );
}