import { Link2 } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Field, FieldGrid } from "../../../components/ui/Field";
import type { PublicVerificationResult } from "../api/publicVerificationApi";
import { VerificationStatus } from "./VerificationStatus";

/**
 * Factual result of a public verification request.
 *
 * The verification state is shown prominently with an explicit text label, and
 * the backend's own meaning sentence is displayed beside it. Blockchain proof is
 * shown only when the response confirms it; otherwise the absence of a
 * confirmed transaction is stated plainly rather than being implied.
 */
export function PublicVerificationResultView({ result }: { result: PublicVerificationResult }) {
  const proof = result.blockchainProof;

  return (
    <Card
      title="Verification result"
      description="This result concerns the submitted file and the evidence recorded by ContractorProof."
    >
      <div className="space-y-5">
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-stone-800">Verification state</span>
            <VerificationStatus status={result.status} />
          </div>
          <p className="mt-3 text-sm leading-6 text-stone-800">{result.meaning}</p>
        </div>

        {result.evidenceVersionId ? (
          <FieldGrid>
            <Field label="Evidence version reference" mono className="sm:col-span-2">
              {result.evidenceVersionId}
            </Field>
          </FieldGrid>
        ) : null}

        <section
          aria-labelledby="blockchain-proof-title"
          className="rounded-lg border border-stone-200 bg-white p-4"
        >
          <h3 id="blockchain-proof-title" className="flex items-center gap-2 font-serif text-lg text-stone-900">
            <Link2 className="h-4 w-4 text-stone-500" aria-hidden="true" />
            Blockchain proof
          </h3>
          <p className="mt-2 text-sm text-stone-700">
            Status: <span className="font-semibold">{proof.confirmed ? "CONFIRMED" : "NOT CONFIRMED"}</span>
          </p>
          {proof.confirmed ? (
            <FieldGrid className="mt-3">
              <Field label="Transaction hash" mono>
                {proof.transactionHash}
              </Field>
              <Field label="Block number" mono>
                {proof.blockNumber}
              </Field>
            </FieldGrid>
          ) : (
            <p className="mt-2 text-sm leading-6 text-stone-600">
              This response does not include a confirmed transaction hash and block number, so no
              blockchain proof is shown. Nothing about the evidence has been changed by that absence.
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-stone-600">
            Blockchain anchors evidence integrity. It is not the system of record for these records
            and does not attest to the accuracy of a claim.
          </p>
        </section>
      </div>
    </Card>
  );
}