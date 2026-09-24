# Agent 2 — Backend / API orchestration

## Owns

`backend/src/app.ts`, `routes/`, `controllers/`, HTTP envelopes, wiring services together.

## Canonical dependencies

- Existing Express app and `/api/v1` router
- Envelope rules: ADR-0004
- Auth middleware: Agent 6
- Repositories: Agent 3
- Evidence/hash/storage: Agent 5
- BlockchainService: Agent 4

## Must do

- Keep health and auth working while adding domain routes
- Replace `/verifications` stub with `/verification` when implementing
- Call `authenticate` + `authorize` + ownership on every implemented domain route
- Call `assertCanAttest` before persisting attestations
- Wire storage, hash, verification, and chain in the official lifecycle order
- Add `requestId` on new errors
- Grandfather auth/health/integration JSON until P1 joint migration with Agent 1

## Must not

- Implement Prisma schema (Agent 3)
- Reimplement SHA-256 or a second chain adapter
- Return storage filesystem paths
- Treat 501 stubs as done
- Open-register privileged roles (Agent 6)

## Depends on

Agent 3 EvidenceVersion migration before evidence POST. Agent 6 JWT/role fixes in Phase 2. Agent 4 adapter ready before proof writes.
