# Agent 3 — Database / Prisma

## Owns

`backend/prisma/schema.prisma`, migrations, `backend/src/repositories/`.

## Canonical dependencies

- Current schema and `20260924120000_init`
- `docs/database/data-model.md`
- ADR-0005 (EvidenceVersion), ADR-0007 (no Passport table), ADR-0002 (no Proof table)

## Must do (Phase 2)

- Additive migration: `EvidenceVersion`, `Evidence.currentVersionId`, denormalized current `Evidence.sha256`
- Resolve unique `(milestoneId, sha256)` vs historical versions
- Repositories for new aggregates
- Optional `Verification` persist + `VerificationStatus` enum if compares are stored
- Keep CRB/NeST fields and `SYNTHETIC_DEMO` defaults

## Must not

- Replace Prisma or PostgreSQL
- Add Passport, Proof, Permission, or score tables
- Rewrite the applied init migration if environments already migrated — add a new migration
- Let services use a second query style (raw SQL) without need

## Depends on

Agent 0 freeze (done). Unblocks Agent 5 evidence writes.
