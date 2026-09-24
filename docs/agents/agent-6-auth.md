# Agent 6 — Authentication / authorization / RBAC

## Owns

JWT, passwords, `authenticate`, `authorize`, `assertCanAttest`, registration policy, user provisioning, JWT boot config.

## Canonical dependencies

- Existing JWT + Argon2id
- ADR-0006
- `backend/src/services/attestation.service.ts`

## Must do (Phase 2, P0)

- Remove silent production JWT fallback
- Restrict public register to CONTRACTOR, CLIENT
- Document/implement first-ADMIN seed
- Plan `POST /api/v1/users` (ADMIN)
- Integrate `assertCanAttest` into the real attest path (with Agent 2)
- Define ownership helpers (contractor owns project, etc.)

## Must not

- Add a second auth system (OAuth/sessions) without ADR
- Rely on frontend RoleGate
- Allow contractor self-attestation

## Depends on

Agent 0 freeze. Coordinates with Agent 1 register UI and Agent 2 route guards.
