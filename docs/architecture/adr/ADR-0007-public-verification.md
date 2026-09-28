# ADR-0007 Public verification and Passport

## Status

Accepted (Agent 0, 2026-09-24)

## Context

Spec and UI mention Performance Passport and public MATCH/MISMATCH. There is no Passport table. GET `/api/v1/public/verify` returns scaffold JSON; POST is 501. The `/verify` page hashes nothing.

## Decision

**Passport is a derived / public projection**, not a stored entity. Do not add a `Passport` table because a placeholder route exists.

Passport is computed from Project, Milestone, current/attested EvidenceVersions, Attestations, and confirmed BlockchainEvents (Proof). Persist a snapshot table only if a later ADR needs publication versioning or caching.

**PublicVerification** is `POST /api/v1/public/verify` (unauthenticated):

- Accept a file plus an identifier (`evidenceVersionId` or `evidenceId`).
- Run the same backend SHA-256 compare as internal verification.
- Return MATCH or MISMATCH (or PENDING / UNAVAILABLE).
- MATCH means fingerprint match only.

Hash-only lookup (no id) may return MATCH/MISMATCH without extra PII; default implemented path is file + id to avoid leaking whether arbitrary hashes exist beyond the public projection.

Public JSON must not include storage paths, emails, password hashes, or private comments.

GET `/api/v1/public/verify` may keep an explanatory payload until POST exists.

## Alternatives Considered

- Passport table now — rejected; second source of truth with no snapshot requirement.
- Browser-only hashing as authority — rejected.
- File-only global search as the only mode — deferred (enumeration risk).

## Task 7 update

The public endpoint now treats MATCH/MISMATCH as comparison against an anchored verification fingerprint: a persisted VERIFICATION event must have a transaction hash, positive block number, and hash matching the stored EvidenceVersion. A pending/unconfirmed event yields PENDING; an absent or inconsistent event yields UNAVAILABLE. Public output can include only the confirmed transaction hash and block number plus the existing evidence-version reference; it does not include private project or contractor records. The API continues to use the canonical backend hash implementation and reads PostgreSQL proof state without querying the chain.

## Consequences

- Agent 7 implements projection + public POST; Agent 3 does not add Passport.
- Agent 1 replaces the `/verify` placeholder with a form that calls the API and displays the returned status.
- `/api/v1/passports` returns the derived projection, not rows from a Passport model.

## Affected Agents

7, 1, 2, 3, 5, 8
