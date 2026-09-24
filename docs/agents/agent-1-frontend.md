# Agent 1 — Frontend / UX

## Owns

`frontend/` React app: routes, layouts, forms, display of API data.

## Canonical dependencies

- Client: `frontend/src/services/api/client.ts` only
- Env: `VITE_API_ORIGIN`
- Auth context already in `frontend/src/features/auth/`
- Contracts: `docs/api/contracts.md`
- Status types: split MATCH family from workflow (ADR-0003)

## Must do

- Remove empty `frontend/src/api/` when touching structure
- Limit register roles to CONTRACTOR and CLIENT
- RoleGate `/verification` (not only hide nav)
- Consume backend verification/passport results; never compute authoritative MATCH
- Show CRB/NeST as synthetic
- Do not invent records when API returns 501
- Wait for Phase 4 for domain screens (Phase 2–3 may prepare types)

## Must not

- Add a second API client
- Add ethers / Prisma / filesystem access
- Store blockchain keys
- Introduce TrustScore UI
- Treat nav visibility as security

## Depends on

Agent 0 freeze (done), Agent 6 role change, Agent 2 envelopes, Agent 5/7 APIs for evidence and public verify.
