# Integration Rules

Status: frozen by Agent 0 (2026-09-24)

## Single sources of truth

| Topic | Authority | Agents must not |
| --- | --- | --- |
| Terminology | `system-overview.md` | Invent Fingerprint/TrustScore types |
| HTTP client | `frontend/src/services/api/client.ts` | Add `frontend/src/api/client.ts` |
| API origin | `VITE_API_ORIGIN` | Introduce `VITE_API_BASE_URL` |
| Hash | `EvidenceVersion.sha256` via `sha256Buffer` | Parallel checksum services |
| Verification | Backend verification service | Frontend-authoritative MATCH |
| Attest authz | `assertCanAttest` | Copy-paste a second gate |
| Chain writes | `BlockchainService` | Frontend ethers writes |
| Schema | `backend/prisma/schema.prisma` | A second ORM/database |
| Passport | Derived projection | Passport table without ADR |
| Mocks | `source: "SYNTHETIC_DEMO"` | Present as live CRB/NeST |

## Change control

Breaking API, schema, or verification semantics requires:

1. Agent 0 review
2. ADR when the decision is architectural
3. Notify affected agents (see briefs in `docs/agents/`)
4. Tests (Agent 8)
5. Documentation update (`docs/api`, `docs/database`, ADRs)

## Implementation phases

| Phase | Who | Work |
| --- | --- | --- |
| 1 | Agent 0 | This freeze (done when ADRs and docs land) |
| 2 | Agents 3, 6, 4 in parallel | EvidenceVersion migration; registration/JWT/RBAC; chain adapter foundations |
| 3 | Agents 5, 2 | Evidence lifecycle + HTTP orchestration |
| 4 | Agents 1, 7 | Frontend domain integration; passport/public verify |
| 5 | Agents 8, 9 | Golden path, tamper tests, security review |
| 6 | Agent 0 | Final integration |

Agents 3, 6, and 4 may start Phase 2 now. Agents 1, 5, 7 must not implement domain features against unfrozen unofficial shapes. Agent 2 may prepare envelopes and route alignment but must not invent schema.

## Response envelopes

Target for **new** domain APIs:

Success:

```json
{ "data": {}, "meta": {} }
```

Error:

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "requestId": "..." } }
```

Grandfathered until coordinated Agent 1 + Agent 2 migration (P1): `/health`, `/api/v1/health`, `/api/v1/auth/*`, `/api/v1/integrations/*` current shapes (`{ token, user }`, `{ error: "string" }`, `{ status, service }`).

Do not add a third shape. See [ADR-0004](adr/ADR-0004-api-versioning.md).

## Mock data

CRB/NeST remain mocks. Every payload keeps `source: "SYNTHETIC_DEMO"` and the existing human notice. Frontend copy must say synthetic.

## Tests the program must eventually have

Golden path and tamper path in the Agent 0 brief. Agent 8 owns them after Phase 3–4 exist. Do not claim verification works without those tests.

## Empty leftover

`frontend/src/api/` is empty and non-canonical. Agent 1 removes the directory when touching frontend structure. Do not put a second client there.
