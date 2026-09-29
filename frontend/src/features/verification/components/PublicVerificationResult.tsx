import { Card } from "../../../components/ui/Card";
import { VerificationStatus } from "./VerificationStatus";
import type { PublicVerificationResult } from "../api/publicVerificationApi";

export function PublicVerificationResultView({ result }: { result: PublicVerificationResult }) {
  const proof = result.blockchainProof;

  return (
    <Card title="Verification result" description="This result concerns the submitted evidence and recorded proof.">
      <div className="space-y-5" aria-live="polite">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-stone-700">Verification state</span>
          <VerificationStatus status={result.status} />
        </div>
        <p className="text-sm leading-6 text-stone-800">{result.meaning}</p>

        {result.evidenceVersionId ? (
          <dl className="grid gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Evidence version reference
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-stone-900">
                {result.evidenceVersionId}
              </dd>
            </div>
          </dl>
        ) : null}

        <section className="rounded-lg border border-stone-200 bg-stone-50 p-4" aria-labelledby="blockchain-proof-title">
          <h3 id="blockchain-proof-title" className="font-serif text-lg text-stone-900">Blockchain proof</h3>
          <p className="mt-2 text-sm text-stone-700">
            Status: <span className="font-semibold">{proof.confirmed ? "CONFIRMED" : "NOT CONFIRMED"}</span>
          </p>
          {proof.confirmed ? (
            <dl className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Transaction hash</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-900">{proof.transactionHash}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-stone-500">Block number</dt>
                <dd className="mt-1 text-sm text-stone-900">{proof.blockNumber}</dd>
              </div>
            </dl>
          ) : (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              A confirmed transaction hash and positive block number are not available in this response.
            </p>
          )}
        </section>
      </div>
    </Card>
  );
}
