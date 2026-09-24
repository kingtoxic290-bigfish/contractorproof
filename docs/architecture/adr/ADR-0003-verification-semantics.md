# ADR-0003 Verification semantics

## Status

Accepted (Agent 0, 2026-09-24)

## Context

Frontend `EvidenceStatus` mixes MATCH, VERIFIED, PENDING, and DISPUTED. Prisma `EvidenceStatus` is PENDING_VERIFICATION / VERIFIED / REJECTED. Attestation and verification were used interchangeably in UI copy. `assertCanAttest` is disconnected from routes.

## Decision

Verification answers only: “Do these bytes match the authoritative SHA-256 / proof?”

Frozen results: **MATCH**, **MISMATCH**, **PENDING**, **UNAVAILABLE**.

Attestation answers: “Did an authorized actor accept or reject the evidence against policy?”

Prisma `EvidenceStatus` / `MilestoneStatus` remain **workflow** states after policy, not verification results.

`assertCanAttest` is the required authorization function on every attest path. Contractors cannot attest.

No TrustScore, SecurityScore, ComplianceScore, SafetyScore, or invented percentages.

## Alternatives Considered

- One enum for match + workflow + disputes — rejected; caused the current frontend/Prisma clash.
- Treating API health as “protected” — rejected.

## Consequences

- Agent 1 splits `frontend/src/types/status.ts`.
- Agent 3 may add a `VerificationStatus` enum; must not reuse `EvidenceStatus` for MATCH.
- Agent 5 implements a single compare function used by app and public verify.
- Agent 6/2 wire `assertCanAttest`.

## Affected Agents

1, 2, 3, 5, 6, 7, 8
