/**
 * POST /verification and POST /attestations do not return blockchain fields.
 * GET /api/v1/blockchain is a 501 stub. This panel reports that absence.
 * It does not invent a transaction, network, or anchored state.
 */
export function BlockchainProof() {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <h3 className="text-sm font-medium text-stone-900">Blockchain proof</h3>
      <p className="mt-1 text-sm text-stone-800">Status: Blockchain proof unavailable</p>
      <p className="mt-2 text-sm text-stone-600">
        This verification response does not include a blockchain transaction. GET /api/v1/blockchain
        is not implemented (501). Blockchain anchoring provides a tamper-evident record of the
        evidence fingerprint when the API later returns that proof. It does not prove the
        underlying claim is true.
      </p>
    </div>
  );
}
