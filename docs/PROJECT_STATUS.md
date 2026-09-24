# ContractorProof — Project Status Ledger

This file is the Agent 1 task ledger. Update it after every task. Use only COMPLETE, PARTIAL, or BLOCKED.

Last inspection: 2026-09-24 (TASK 0). No application features were implemented in TASK 0.

---

## CURRENT TASK

TASK 0 — Repository baseline, Git control, architecture inspection, and this ledger.

## STATUS

COMPLETE

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
| Contractors GET | PARTIAL | Authenticate-only; no ownership filter |
| Projects / milestones GET | PARTIAL | Authenticate-only; no `POST /projects` or `POST /milestones` |
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
