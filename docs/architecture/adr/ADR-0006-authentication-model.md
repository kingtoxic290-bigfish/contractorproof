# ADR-0006 Authentication model

## Status

Accepted (Agent 0, 2026-09-24)

## Context

JWT + Argon2id already work. Public register allows every role except ADMIN, including AUDITOR and CONSULTANT_ENGINEER. JWT secret has a silent development fallback. Domain routes authenticate but rarely authorize. `assertCanAttest` is unused. Frontend RoleGate covers `/audit` only.

## Decision

- Keep JWT access tokens (12h) and Argon2id. No second auth system. No refresh token in Phase 1.
- Public registration roles: **CONTRACTOR** and **CLIENT** only.
- Privileged roles provisioned only by an operator seed (first ADMIN) or future ADMIN `POST /api/v1/users`.
- Production must refuse to start without a strong `JWT_SECRET` (not the compiled fallback).
- Every implemented domain route: authenticate + role authorize + ownership where applicable.
- `assertCanAttest` is mandatory on attestation writes.
- Frontend nav hiding is UX only.

## Alternatives Considered

- OAuth/OIDC now — rejected; no IdP in repo; would be a second system.
- Refresh tokens now — deferred; needs another ADR.
- Keep open privileged self-register for demo speed — rejected (P0).

## Consequences

- Agent 6 changes `PUBLIC_REGISTER_ROLES` and JWT boot rules; adds seed docs/script.
- Agent 1 limits the register `<select>` to CONTRACTOR and CLIENT.
- Agent 2 applies `authorize` + ownership on implemented routes.
- Existing tokens remain valid until expiry after role-policy change.

## Affected Agents

6, 1, 2, 8, 9
