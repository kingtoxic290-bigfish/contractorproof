# ADR-0005 Evidence versioning and hash authority

## Status

Accepted (Agent 0, 2026-09-24)

## Context

Prisma `Evidence` has `sha256`, `storageKey`, and `updatedAt`, with uniqueness `(milestoneId, sha256)`. There is no version table. Spec requires append-oriented history. `BlockchainEvent.evidenceHash` is a second column name for a hash.

## Decision

Introduce **EvidenceVersion** as the immutable file+hash record.

- Canonical application hash: `EvidenceVersion.sha256` (lowercase hex SHA-256 of bytes).
- `storageReference` is stored on the version (`storageKey` column name may remain).
- `Evidence` points at `currentVersionId`.
- `Evidence.sha256` is retained as a **denormalized current-version hash** so existing indexes/queries can migrate without a second algorithm. It must always equal `currentVersion.sha256`.
- Replacing a file creates a new version; old versions are not overwritten.
- `BlockchainEvent.evidenceHash` must equal the proven version’s `sha256`. It is a copy for the event, not an independent digest.

Evidence.sha256 alone is not sufficient for history because `updatedAt` would invite in-place mutation.

## Alternatives Considered

- Keep only `Evidence.sha256` and forbid updates — rejected; corrections/variations need linked versions.
- Drop `Evidence.sha256` immediately — possible later; denormalized current hash reduces join churn in Phase 2.
- Separate hashing libraries per agent — rejected.

## Consequences

- Agent 3 adds `EvidenceVersion` and `currentVersionId` in a new migration (do not rewrite the init migration in place if it has already been applied; additive migration).
- Agent 5 writes versions only.
- Unique `(milestoneId, sha256)` must be redefined so superseded versions can keep historical hashes (unique on current version or on `(evidenceId, sha256)`).

## Affected Agents

3, 5, 2, 4, 7, 8
