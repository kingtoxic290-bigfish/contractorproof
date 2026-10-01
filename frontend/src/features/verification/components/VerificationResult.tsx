import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import {
  MISMATCH_EXPLANATION,
  meaningForVerificationStatus,
  type PublicVerification,
} from "../types";
import { BlockchainProof } from "./BlockchainProof";
import { VerificationStatus } from "./VerificationStatus";

export function VerificationResult({ result }: { result: PublicVerification }) {
  const meaning = meaningForVerificationStatus(result.status);
  const [copyMessage, setCopyMessage] = useState("");

  async function copySha256() {
    if (!result.sha256) return;
    try {
      await navigator.clipboard.writeText(result.sha256);
      setCopyMessage("SHA-256 copied.");
    } catch {
      setCopyMessage("Clipboard access is unavailable; select the full hash to copy it.");
    }
  }

  return (
    <Card title="Fingerprint comparison result">
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-stone-500">Integrity state</span>
          <VerificationStatus status={result.status} />
        </div>

        {result.status === "MISMATCH" ? (
          <p className="text-sm text-amber-950">{MISMATCH_EXPLANATION}</p>
        ) : null}
        {meaning ? <p className="text-sm text-stone-700">{meaning}</p> : null}
        {result.status === "MATCH" ? (
          <p className="text-sm text-stone-600">
            MATCH is a fingerprint result. It does not change evidence workflow status to VERIFIED
            and is not an attestation.
          </p>
        ) : null}

        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">
              {result.evidenceId ?? "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Source</dt>
            <dd className="mt-1 text-sm text-stone-900">{result.source}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-500">Recorded at</dt>
            <dd className="mt-1 text-sm text-stone-900">
              {result.createdAt ? (
                <time dateTime={result.createdAt}>{result.createdAt}</time>
              ) : (
                "Not recorded"
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Verification identifier</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">
              {result.id ?? "Not persisted"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence version</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-900">
              {result.evidenceVersionId ?? "Not provided"}
            </dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Authoritative fingerprint</dt>
            <dd className="mt-1 flex min-w-0 flex-wrap items-start gap-2">
              <code className="min-w-0 flex-1 break-all font-mono text-xs text-stone-900">
                {result.sha256 ?? "Not provided"}
              </code>
              {result.sha256 ? (
                <Button type="button" variant="secondary" onClick={() => void copySha256()}>
                  Copy SHA-256
                </Button>
              ) : null}
            </dd>
            <p className="mt-1 text-xs text-stone-600" role="status" aria-live="polite">{copyMessage}</p>
          </div>
        </dl>

        <BlockchainProof proof={result.proof} />
      </div>
    </Card>
  );
}
