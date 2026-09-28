import type { PublicVerificationProof } from "../types";

/** Displays only proof metadata returned alongside this verification result. */
export function BlockchainProof({ proof }: { proof: PublicVerificationProof | null }) {
  const state = !proof
    ? "NO PROOF"
    : proof.txHash && proof.blockNumber != null && proof.blockNumber > 0
      ? "CONFIRMED"
      : "PENDING";

  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <h3 className="text-sm font-medium text-stone-900">Blockchain proof</h3>
      <p className="mt-1 text-sm text-stone-800">Status: {state}</p>
      <p className="mt-2 text-sm text-stone-600">
        {state === "NO PROOF"
          ? "The verification response did not include blockchain proof metadata."
          : "Proof metadata is shown only as returned by the verification response. It does not prove the underlying claim is true."}
      </p>
      {proof ? (
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Event</dt>
            <dd className="mt-1 break-words text-stone-800">{proof.eventType}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Transaction hash</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-800">
              {proof.txHash ?? "Not provided"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Block number</dt>
            <dd className="mt-1 text-stone-800">{proof.blockNumber ?? "Not confirmed"}</dd>
          </div>
          <div className="min-w-0 sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Anchored evidence hash</dt>
            <dd className="mt-1 break-all font-mono text-xs text-stone-800">
              {proof.evidenceHash ?? "Not provided"}
            </dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
