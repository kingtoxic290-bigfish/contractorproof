# ADR-0004 API versioning and envelopes

## Status

Accepted (Agent 0, 2026-09-24)

## Context

All application APIs already sit under `/api/v1` except unversioned `GET /health`. Working auth returns `{ token, user }` and `{ error: string }`. Domain stubs return `{ error, resource }` with 501. A single envelope is required so Agent 1 does not grow one-off parsers.

## Decision

- Application prefix remains `/api/v1/`.
- Keep `GET /health` (and `/api/v1/health`) for liveness.
- Canonical families: `/auth`, `/users`, `/contractors`, `/projects`, `/milestones`, `/evidence`, `/verification`, `/attestations`, `/passports`, `/disputes`, `/corrections`, `/variations`, `/audit`, `/public/verify`, `/health`. Nested `/projects/:projectId/milestones` remains the create/list path.
- Existing stub `/api/v1/verifications` is retired when `/api/v1/verification` is implemented. Do not run both.
- **New** domain endpoints use:

```json
{ "data": {}, "meta": {} }
```

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "requestId": "..." } }
```

- Working auth, health, and integration payloads are grandfathered until a single Agent 1+2 migration (P1). No third format.
- Breaking changes need Agent 0 review, ADR if architectural, agent notice, tests, and doc updates.

Do not implement unused endpoints just to occupy the list.

## Alternatives Considered

- Immediate rewrite of login responses — rejected; would break the working frontend in the same change set as architecture-only work.
- `/api/v2` now — rejected; nothing is published.

## Consequences

- Agent 2 adds envelope helpers and `requestId`.
- Agent 1 keeps parsing current auth until the P1 migration.
- Resource contracts live in `docs/api/contracts.md` before UI implementation.

## Affected Agents

1, 2, 6, 7, 8
