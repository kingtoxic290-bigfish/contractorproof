import { Card } from "../../../components/ui/Card";
import { QueryPanel } from "../../shared/QueryPanel";
import { useVerificationHistory } from "../hooks/useVerificationHistory";
import { VerificationStatus } from "./VerificationStatus";

function proofIsConfirmed(proof: { txHash: string | null; blockNumber: number | null }): boolean {
  return Boolean(proof.txHash && proof.blockNumber != null && proof.blockNumber > 0);
}

export function VerificationHistory({
  evidenceId,
  evidenceVersionId,
}: {
  evidenceId?: string;
  evidenceVersionId?: string;
}) {
  const history = useVerificationHistory(evidenceId, evidenceVersionId);

  return (
    <QueryPanel
      status={history.status}
      error={history.error}
      onRetry={history.retry}
      loadingMessage="Loading persisted verification history..."
      emptyTitle="No verification results yet."
      emptyDescription="The authorized passport projection contains no verification records for this evidence context."
    >
      <Card title="Persisted verification history" description="Historical records are shown in the order returned by the backend and are not replaced by a later comparison.">
        <ol className="space-y-4">
          {history.records.map((entry) => {
            const proof = entry.proof;
            const confirmed = proof ? proofIsConfirmed(proof) : false;
            return (
              <li key={entry.verification.id} className="border-t border-stone-200 pt-4 first:border-0 first:pt-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <VerificationStatus status={entry.verification.status} />
                  <time className="text-sm text-stone-600" dateTime={entry.verification.createdAt}>
                    {entry.verification.createdAt}
                  </time>
                </div>
                <dl className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Verification ID</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-stone-900">{entry.verification.id}</dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Project</dt>
                    <dd className="mt-1 break-words text-sm text-stone-900">
                      {entry.projectName} <span className="break-all font-mono text-xs">({entry.projectId})</span>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Milestone</dt>
                    <dd className="mt-1 break-words text-sm text-stone-900">
                      {entry.milestoneName} <span className="break-all font-mono text-xs">({entry.milestoneId})</span>
                    </dd>
                  </div>
                  <div className="min-w-0">
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence / version</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-stone-900">
                      {entry.evidenceId} / v{entry.versionNumber} ({entry.evidenceVersionId})
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Source</dt>
                    <dd className="mt-1 text-sm text-stone-900">{entry.verification.source}</dd>
                  </div>
                  <div className="min-w-0 sm:col-span-2">
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Backend SHA-256</dt>
                    <dd className="mt-1 break-all font-mono text-xs text-stone-900">{entry.sha256}</dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-stone-500">Blockchain proof</dt>
                    <dd className="mt-1 text-sm text-stone-900">
                      {!proof ? "Not returned" : confirmed ? "CONFIRMED" : "PENDING"}
                    </dd>
                  </div>
                  {proof ? (
                    <>
                      <div className="min-w-0">
                        <dt className="text-xs uppercase tracking-wide text-stone-500">Transaction hash</dt>
                        <dd className="mt-1 break-all font-mono text-xs text-stone-900">{proof.txHash ?? "Not provided"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs uppercase tracking-wide text-stone-500">Block number</dt>
                        <dd className="mt-1 text-sm text-stone-900">{proof.blockNumber ?? "Not provided"}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>
              </li>
            );
          })}
        </ol>
      </Card>
    </QueryPanel>
  );
}