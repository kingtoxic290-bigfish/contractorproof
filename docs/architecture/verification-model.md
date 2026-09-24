# Verification Model

Status: frozen by Agent 0 (2026-09-24)  
Decision records: [ADR-0003](adr/ADR-0003-verification-semantics.md), [ADR-0007](adr/ADR-0007-public-verification.md)

## Verification is not attestation

| Question | Concept | Result |
| --- | --- | --- |
| Does this file match the authoritative SHA-256 / proof? | Verification | MATCH, MISMATCH, PENDING, UNAVAILABLE |
| Did an authorized actor declare that policy was satisfied? | Attestation | APPROVED, REJECTED |
| Was the hash anchored on-chain? | Proof / BlockchainEvent | txHash present or not |

Do not use one enum for all three.

## Verification results (frozen)

| Status | Meaning | Must not mean |
| --- | --- | --- |
| MATCH | Presented bytes hash to the authoritative `EvidenceVersion.sha256` (and, when a proof is checked, to `BlockchainEvent.evidenceHash`) | The construction claim is true; the contractor is trusted |
| MISMATCH | Hashes differ | “Unsafe building”; failed scan |
| PENDING | Compare cannot be completed yet (hash or proof not ready) | Verified |
| UNAVAILABLE | Authoritative store, record, or service cannot be read | Zero threats; API health |

Do not invent percentages.

## Prisma / frontend split

| Name | Values | Use |
| --- | --- | --- |
| `VerificationStatus` (new, application) | MATCH, MISMATCH, PENDING, UNAVAILABLE | Compare results only |
| Prisma `EvidenceStatus` (existing) | PENDING_VERIFICATION, VERIFIED, REJECTED | Workflow after policy/attestation |
| Prisma `MilestoneStatus` | PENDING, IN_PROGRESS, PENDING_VERIFICATION, VERIFIED, REJECTED | Milestone workflow |
| Prisma `AttestationDecision` | APPROVED, REJECTED | Attestation only |
| Frontend `types/status.ts` today | Mixes MATCH with VERIFIED and DISPUTED | Agent 1 must split this union |

`EvidenceStatus.VERIFIED` means policy-satisfied attestation, not MATCH.

Agent 3 persisted compare history on `Verification` (`VerificationStatus` + `VerificationSource`). Agent 5/7 write those rows when they implement compare. Do not store MATCH on `Evidence.status`.

## Who computes MATCH

Only the backend verification service (Agent 5, exposed by Agent 2 / Agent 7).

Algorithm:

1. Read presented file bytes.
2. `sha256Buffer(bytes)`.
3. Load authoritative `EvidenceVersion.sha256` for the given `evidenceVersionId` (or current version of `evidenceId`).
4. Timing-safe string compare of lowercase hex.
5. Return MATCH or MISMATCH. If the version or bytes cannot be loaded, UNAVAILABLE. If the version has no hash yet, PENDING.

Public verify uses the same function. The frontend only displays the returned status.

## Attestation rules

Reuse and **call** `backend/src/services/attestation.service.ts` `assertCanAttest` on every attest path.

A contractor must never attest their own evidence:

- `actor.role === CONTRACTOR` → 403
- `actor.id === evidenceUploaderId` → 403
- `actor.id === contractorUserId` → 403

Additional rules (Agent 6):

- Role must be in the milestone `VerificationPolicy.allowedRoles`
- Actor must be authenticated
- Evidence version should be MATCH before APPROVED attestation (REJECTED may be allowed without MATCH only if product later ADR says so; default: require stored hash to exist)
- Unique `(evidenceId, verifierId)` already in schema — keep

Milestone becomes `VERIFIED` only when `requiredApprovals` APPROVED attestations from allowed roles exist. That is attestation policy, not MATCH.

## Proof relationship

After policy is satisfied, backend writes chain + `BlockchainEvent`. Verification against a proof compares the presented hash to `EvidenceVersion.sha256` and confirms `BlockchainEvent.evidenceHash` equals that value and `txHash` is set. A missing tx is PENDING/UNAVAILABLE for **proof** checks, not an automatic MISMATCH of the file.
