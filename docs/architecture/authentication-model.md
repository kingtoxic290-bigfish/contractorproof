# Authentication and Authorization Model

Status: frozen by Agent 0 (2026-09-24)  
Decision record: [ADR-0006](adr/ADR-0006-authentication-model.md)

## Separation

| Concern | Question | Mechanism |
| --- | --- | --- |
| Authentication | Who are you? | Email + password, Argon2id, JWT access token |
| Authorization | What may you do? | Role + `authorize(...)` + ownership + `assertCanAttest` |

Hidden frontend nav is not authorization.

## Authentication (keep existing)

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- Header: `Authorization: Bearer <token>`
- Sign/verify: `backend/src/utils/jwt.ts` (12h expiry)
- Password: `backend/src/utils/password.ts` (Argon2id)
- Frontend session: `frontend/src/utils/session.ts` (`localStorage` key `contractorproof_token`)
- No refresh token in Phase 1. Expiry → `SESSION_EXPIRED` → login. A refresh design needs a new ADR.

## P0 JWT secret

`backend/src/config/env.ts` currently falls back to a development JWT secret if `JWT_SECRET` is unset.

Required behavior (Agent 6):

- Production (`NODE_ENV=production`): missing or well-known fallback secret → process must not start
- Development: explicit `.env` value required in documented setup; fallback may exist only behind a clearly named local flag, not silently

## Roles

Login roles (unchanged enum):

`CONTRACTOR` | `CLIENT` | `CONSULTANT_ENGINEER` | `PROCUREMENT_OFFICER` | `AUDITOR` | `ADMIN`

`SITE_INSPECTOR` and `CLIENT_REPRESENTATIVE` remain `VerificationPolicy.verifierLabels` only.

### Public registration (change required)

Today any non-ADMIN role can self-register. That is rejected.

**Approved public roles:** `CONTRACTOR`, `CLIENT` only.

Privileged roles (`ADMIN`, `AUDITOR`, `CONSULTANT_ENGINEER`, `PROCUREMENT_OFFICER`) must not appear on the public register form as selectable values that the API accepts.

### Approved provisioning

1. **First ADMIN:** operator seed documented by Agent 6 (Prisma seed or one-off script using env, never committed secrets). Not public register.
2. **Later privileged users:** authenticated ADMIN creates them via a future `POST /api/v1/users` (Agent 2 + Agent 6). Until that endpoint exists, the same seed/script is the only provisioning path.
3. CONTRACTOR register continues to create the `Contractor` row (`legalName` from `fullName`, `crbSource: SYNTHETIC_DEMO`).

## Authorization layers (every protected domain route)

1. `authenticate` — JWT, user still exists
2. `authorize(...roles)` — role allow-list
3. Ownership / resource check — contractor owns project; project members; auditors read-only as specified
4. Extra gates — `assertCanAttest` on attest; public verify is the exception (no JWT)

Existing 501 stubs only call `authenticate` (blockchain list also uses `authorize`). That is insufficient for implementation. Agent 2 must not ship domain writes with authenticate-only.

## Contractor self-attestation

Forbidden. Integrate `assertCanAttest` on POST `/api/v1/attestations` (and any future attest path). Frontend hiding `/verification` is cosmetic; `/verification` currently has no `RoleGate`. Agent 1 should gate the page; Agent 6/2 must enforce 403 regardless.

## Token and error handling (frontend)

Keep current client behavior: 401 clears session; 403 → `/forbidden`; 501 → unavailable module, do not invent rows.

## Permissions in Phase 1

No `Permission` table. Permission is `role` + resource ownership functions in services. Do not add a CASL/policy engine unless a later ADR requires it.
