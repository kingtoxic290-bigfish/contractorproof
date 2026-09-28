# API Overview

Status: frozen by Agent 0 (2026-09-24)  
Detail: [contracts.md](contracts.md)  
Decision: [ADR-0004](../architecture/adr/ADR-0004-api-versioning.md)

## Base

- Origin: backend `PORT` (default `http://localhost:4000`)
- Application prefix: `/api/v1`
- Frontend env: `VITE_API_ORIGIN` (not `VITE_API_BASE_URL`)
- Client: `frontend/src/services/api/client.ts` builds `{VITE_API_ORIGIN}/api/v1`
- Auth header: `Authorization: Bearer <token>`

## Families

| Family | Canonical paths | Status now | Implement when |
| --- | --- | --- | --- |
| Health | `GET /health`, `GET /api/v1/health` | Working | Keep |
| Auth | `/api/v1/auth/register`, `/login`, `/me` | Working | Agent 6 tightens roles/JWT |
| Users | `/api/v1/users` | Missing | Agent 6 + 2, privileged provision |
| Contractors | `/api/v1/contractors` | Working GET list/detail | Writes remain out of scope |
| Projects | `/api/v1/projects` | Working GET list/detail | Writes remain out of scope |
| Milestones | `/api/v1/projects/:projectId/milestones` | Working project-scoped GET | No standalone `/milestones` collection |
| Evidence | `/api/v1/evidence` | Working HTTP (Agent 2 + Agent 5) | Keep; no storage paths |
| Verification | `/api/v1/verification` | Working POST | `/verifications` retired |
| Attestations | `/api/v1/attestations` | 501 | Phase 3 |
| Passports | `/api/v1/passports` | 501 | Phase 4 derived projection |
| Disputes | `/api/v1/disputes` | 200 / 201 | Authenticated project access; append-only lifecycle |
| Corrections | `/api/v1/corrections` | 501 | After evidence |
| Variations | `/api/v1/variations` | 501 | After evidence |
| Audit | `/api/v1/audit` | Missing | After writes exist |
| Public verify | `/api/v1/public/verify` | GET scaffold, POST compare | Agent 7 owns Passport presentation |
| Integrations | `/api/v1/integrations/crb/:id`, `/nest/:id` | Working mocks | Keep labeled synthetic |
| Blockchain admin | `/api/v1/blockchain` | 501, ADMIN/AUDITOR | Optional read of events |

Do not add endpoints only to complete this table.

## Envelopes

New domain APIs:

```json
{ "data": {}, "meta": {} }
```

```json
{ "error": { "code": "NOT_IMPLEMENTED", "message": "…", "requestId": "…" } }
```

Grandfathered: health, auth, integrations (see ADR-0004). 501 stubs may keep `{ error, resource }` until replaced by the nested error object.

## Breaking changes

Agent 0 review, ADR if architectural, notify affected agents, tests, update this folder.
