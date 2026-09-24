# ContractorProof — Project Status Ledger

This file is the Agent 1 task ledger. Update it after every task. Use only COMPLETE, PARTIAL, or BLOCKED.

---

## CURRENT TASK

TASK 1 — Projects, Milestones & Ownership/IDOR

## STATUS

COMPLETE

---

## TASK 1

TASK:
Projects, Milestones & Ownership/IDOR

STATUS:
COMPLETE

IMPLEMENTED:

* `POST /api/v1/projects` — CONTRACTOR creates against their own Contractor profile; ADMIN must supply `contractorId`. Client-supplied `contractorId` is ignored for CONTRACTOR.
* `POST /api/v1/milestones` — body `{ projectId, name, description?, policyId? }`.
* `POST /api/v1/projects/:projectId/milestones` — same create, project id from the path (frozen nested family).
* `GET /api/v1/milestones/:milestoneId` — same read matrix as the parent project.

AUTHORIZATION:

* Write: `PROJECT_WRITE` / `MILESTONE_WRITE` = CONTRACTOR, ADMIN, plus `assertCanWriteProject` ownership.
* Read lists: ADMIN / AUDITOR / PROCUREMENT_OFFICER see all; CONTRACTOR sees own rows only; CLIENT / CONSULTANT_ENGINEER get `[]` (no membership table).
* Read detail: owner or privileged → 200; other authenticated users → 403; missing → 404.
* GET envelopes stay grandfathered `{ projects }`, `{ project }`, `{ contractors }`, `{ milestones }`. POST create uses `{ data, meta }`.

TESTS:

* `npx vitest run test/projects.write.test.ts test/projects.test.ts test/contractors.test.ts test/qa/e2e.stage2-authz.test.ts test/qa/e2e.golden.test.ts` — 38/38 PASS
* Evidence regression `test/evidence.test.ts test/evidence.http.test.ts` — 24/24 PASS
* `npx tsc --noEmit` — PASS
* `npx prisma validate` — PASS
* `npx vitest run --testTimeout=20000` — 203/203 PASS
* Default `npm test` (5s timeout) still flakes first-in-file Argon2 tests under parallel load; not a Task 1 logic failure.

FILES CREATED:

* `backend/src/routes/milestones.routes.ts`
* `backend/test/projects.write.test.ts`

FILES MODIFIED:

* `backend/src/authz/permissions.ts`
* `backend/src/authz/index.ts`
* `backend/src/services/access.service.ts`
* `backend/src/repositories/project.repository.ts`
* `backend/src/repositories/contractor.repository.ts`
* `backend/src/services/project.service.ts`
* `backend/src/services/contractor.service.ts`
* `backend/src/controllers/projects.controller.ts`
* `backend/src/controllers/contractors.controller.ts`
* `backend/src/routes/projects.routes.ts`
* `backend/src/routes/index.ts`
* `backend/test/projects.test.ts`
* `backend/test/contractors.test.ts`
* `backend/test/qa/e2e.stage2-authz.test.ts`
* `backend/test/qa/e2e.golden.test.ts`
* `docs/PROJECT_STATUS.md`

KNOWN LIMITATIONS:

* CLIENT / CONSULTANT_ENGINEER still have no project membership model; they cannot read or write another contractor's projects (403 / empty list).
* There is no `GET /api/v1/milestones` collection (only `GET /milestones/:milestoneId` and `GET /projects/:projectId/milestones`).
* Stage 2 GET JSON remains grandfathered; create responses use `{ data, meta }`.
* Default Vitest 5s timeout can still flake under full parallel `npm test`.

NEXT TASK:
TASK 2 — Blockchain foundation

---

## TASK 0 (baseline)

STATUS: COMPLETE

Commit: `03af5a03045b682c4ad7e4d440206f59ab8fe15d`

---

## Architecture snapshot (inspected)

| Layer | Location | Stack |
| --- | --- | --- |
| Frontend | `frontend/` | React 18, Vite 6, TypeScript, Tailwind, React Router 6 |
| Backend | `backend/` | Node, Express 4, TypeScript, Prisma 6, JWT, Argon2id, Multer, ethers 6 |
| Database | `backend/prisma/` + Docker Postgres 16 | Host port 5433 |
| Contracts | `contracts/` | Hardhat 2, Solidity 0.8.24, `ContractorProofRegistry.sol` |
| Docs | `docs/` | Architecture ADRs, API contracts, agent briefs |

There is no `hardhat/` directory. There is no root `prisma/` or root `tests/`. Tests live in `backend/test/`, `frontend/src/tests/` and feature `*.test.ts`, and `contracts/test/`.

Request path: frontend `VITE_API_ORIGIN` → `GET /health` and `/api/v1/*` on the Express app (`backend/src/app.ts`).

---

## Backend (inspected)

Mounted under `/api/v1` from `backend/src/routes/index.ts`.

| Area | Status | Notes |
| --- | --- | --- |
| Health | COMPLETE | `GET /health`, `GET /api/v1/health` |
| Auth | COMPLETE | `POST /auth/register` (CONTRACTOR, CLIENT), `POST /auth/login`, `GET /auth/me` |
| Privileged users | COMPLETE | `POST /users` ADMIN only |
| Contractors GET | COMPLETE | Scoped: owner or privileged; CLIENT/CE empty / 403 |
| Projects / milestones | COMPLETE | POST create + scoped GET; no membership for CLIENT/CE |
| Evidence POST/GET | COMPLETE | SHA-256 + EvidenceVersion; no get-by-id / version HTTP |
| Verification POST | COMPLETE | MATCH / MISMATCH / PENDING / UNAVAILABLE; does not write chain |
| Attestation POST | COMPLETE | GET `/attestations` is 501 |
| Disputes POST/GET | PARTIAL | Create OPEN only; no resolve; no chain event |
| Corrections POST/GET | PARTIAL | Requires existing `BlockchainEvent`; HTTP never creates those |
| Variations | NOT IMPLEMENTED | GET/POST 501 |
| Passports | NOT IMPLEMENTED | GET 501 |
| Blockchain HTTP | NOT IMPLEMENTED | GET 501; `BlockchainService` is not called from routes |
| Public verify POST | COMPLETE | Unauthenticated compare; GET is scaffold JSON |
| CRB / NeST | PARTIAL | Authenticated mocks, `SYNTHETIC_DEMO` |
| Audit HTTP | NOT IMPLEMENTED | `audit.service` used on register/login only |

501 helper: `notImplemented()` in `backend/src/middleware/errorHandler.ts`.

---

## Frontend (inspected)

Routes in `frontend/src/app/router.tsx`. Single client: `frontend/src/services/api/client.ts`.

Implemented screens: login/register, dashboard, contractors, projects, milestones, evidence, verification (RoleGate), composed passport history.

Placeholders: `/disputes`, `/corrections`, `/variations`, `/audit`, `/settings`.

`/verify` does not call `POST /api/v1/public/verify`. Register UI offers roles other than CONTRACTOR/CLIENT; backend rejects those.

---

## Database (inspected)

`backend/prisma/schema.prisma` plus migrations `20260924120000_init` and `20260924180000_evidence_versioning`.

Models present: User, Contractor, Project, VerificationPolicy, Milestone, Evidence, EvidenceVersion, Verification, Attestation, BlockchainEvent, Dispute, Correction, ContractVariation, AuditLog.

No Passport table (ADR-0007). `BlockchainEvent` has no status enum and no unique logical key.

---

## Blockchain (inspected)

- Contract: `contracts/contracts/ContractorProofRegistry.sol` (hash/id events only).
- Adapter: `backend/src/blockchain/BlockchainService.ts` (`registerProject`, `recordVerification`, `recordAttestation`).
- ABI also lists correction/dispute/resolution/variation; the service has no methods for those.
- HTTP never persists `BlockchainEvent`. `CONTRACT_ADDRESS` is empty in `.env.example`.

---

## Tests (last measured on this machine, 2026-09-24, before TASK 0)

TASK 0 did not re-run the full suites. Last measured results:

| Suite | Result |
| --- | --- |
| `cd backend && npx prisma validate` | PASS |
| `cd backend && npx tsc --noEmit` | PASS |
| `cd backend && npm test` | 184 passed, 2 failed (5s timeout flake; isolated re-run 19/19 PASS) |
| `cd frontend && npx tsc --noEmit -p tsconfig.app.json` | PASS |
| `cd frontend && npm test` | 157/157 PASS |
| `cd contracts && npm test` | 6/6 PASS |

---

## FILES CREATED

- `docs/PROJECT_STATUS.md`

## FILES MODIFIED

- None (application source unchanged). First git commit also records the previously untracked repository tree.

---

## TESTS RUN (TASK 0)

- `git check-ignore -v backend/.env frontend/.env`
- Confirmed no `TODO` implementation work and no application source edits in this task.

## TEST RESULTS

- `backend/.env` and `frontend/.env` are ignored (`.gitignore`).
- `.env.example` is the only env template tracked.
- No application tests were required for this documentation/git-control task.

---

## KNOWN ISSUES

- No git commits existed before TASK 0; no remote configured.
- `GET /contractors` and `GET /projects` are authenticate-only (IDOR / ownership gap).
- No HTTP project or milestone creation.
- `BlockchainService` is not wired to HTTP; `BlockchainEvent` rows are not created by the API.
- `GET /passports` and `GET /passports/:projectId` return 501.
- `GET /attestations`, `GET /blockchain`, GET/POST `/variations` return 501.
- Corrections require a `BlockchainEvent` the API never writes.
- Frontend public verify page is a stub; disputes/corrections pages are placeholders.
- Frontend register offers privileged roles; backend allows CONTRACTOR and CLIENT only.
- README and `docs/api/api-overview.md` understate implemented routes.
- Full backend `npm test` can flake two first-in-file evidence tests at the default 5s timeout under parallel load.

---

## NEXT TASK

TASK 1 — Projects + milestones creation and ownership/IDOR fixes.
