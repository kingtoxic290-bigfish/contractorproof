# ContractorProof — Project Status Ledger

This file is the Agent 1 task ledger. Update it after every task. Use only COMPLETE, PARTIAL, or BLOCKED.

---

## CURRENT TASK

TASK 4 — Dispute Lifecycle

## STATUS

COMPLETE

Disputes support creation, project-scoped reads, review, and append-only terminal resolution. The
original evidence, versions, and verification rows remain unchanged. Evidence/original event
references are validated after authorization. Resolution actor and timestamp are stored in a
separate `DisputeResolution` row; one resolution per dispute is enforced. Repeated identical
resolution submissions reuse the persisted result, while a conflicting result returns 409.

Blockchain anchoring uses existing contract `recordDispute` and `recordResolution` methods only
when the referenced source proof is confirmed. Pending `BlockchainEvent` rows remain explicitly
unconfirmed; chain failure leaves the dispute/resolution available as a database business record.
Disputes without a confirmed source event have no blockchain proof. No contract changes were made.

Authorization reuses existing project helpers. Contractors can create/read only for their own
projects; ADMIN can create and existing privileged reader/resolver roles follow their access
matrix. Cross-contractor reads/writes are denied before mutation. Passport was not changed.

TESTS:

* Focused dispute + history tests — 29/29 PASS
* Passport tests — 8/8 PASS
* Full backend — 222/222 PASS
* Hardhat — 6/6 PASS
* `npx tsc --noEmit` — PASS
* `npx prisma validate` — PASS (existing Prisma package config deprecation warning)

KNOWN LIMITATIONS:

* Distinct disputes may be raised against the same milestone/evidence; no domain uniqueness rule
  exists. Matching resolution retries are idempotent, but creating a dispute is not.
* Blockchain dispute/resolution anchors are optional and require a previously confirmed source
  event; the database lifecycle remains authoritative when no source proof is available.

Commit hash is reported in the Task 4 completion report.

---

## TASK 3 — Derived Contractor Passport

COMPLETE

Passport is a read-only projection over Contractor, Project, Milestone, EvidenceVersion,
Verification, Attestation, and BlockchainEvent records. No Passport table or blockchain
read calls were added. GET `/api/v1/passports` lists projects available to the caller;
GET `/api/v1/passports/:projectId` applies the existing project read authorization.

---

## TASK 2A

TASK:
Blockchain Foundation

STATUS:
COMPLETE

CONTRACT:

* `ContractorProofRegistry.sol` unchanged — Hardhat suite 6/6 PASS (register, authorize, verification, attestation, duplicate eventId, SHA-256 bytes32).

BLOCKCHAINSERVICE:

* `registerProject`, `recordVerification` / `recordProof`, `recordAttestation` verified against live Hardhat.
* Signer uses cached `NonceManager` so sequential writes on one service keep a stable nonce.
* Failures map to `BlockchainError` codes: NOT_CONFIGURED, PROVIDER_FAILURE, WRONG_NETWORK, WRONG_CONTRACT, SIGNER_UNAVAILABLE, CONFIRMATION_FAILED, DUPLICATE_PROOF, TRANSACTION_FAILED, EVENT_MISMATCH.
* Does not report success without receipt.status == 1 (and VerificationRecorded arg checks for verification).

BLOCKCHAINEVENT:

* Added required unique `logicalKey` (`${eventType}:${projectId}:${referenceId|projectId}`).
* No status column — confirmed proof remains non-null `txHash` (ADR-0002).
* `blockchainEventRepository.createPending` / `confirm` provide idempotent persistence; retries return the existing row; raw unique violations are P2002.

IDEMPOTENCY:

* DB: unique `logicalKey` + createPending race handling.
* Chain: duplicate `eventId` → DUPLICATE_PROOF.
* Live test proves one logical VERIFICATION row and contract duplicate rejection.

TRANSACTION FAILURE HANDLING:

* success → ConfirmedProof / confirm(txHash, blockNumber)
* revert / failed send → TRANSACTION_FAILED or mapped duplicate/auth errors
* RPC down → PROVIDER_FAILURE
* missing / status!=1 receipt → CONFIRMATION_FAILED
* duplicate eventId → DUPLICATE_PROOF

LOCAL EVM:

* Vitest `globalSetup` starts `npx hardhat node` when needed; `ensureLocalHardhat` reuses an existing healthy node and handles EADDRINUSE.
* Previous RPC failures were environmental (port busy / orphan node / nonce races across parallel live files), not contract defects.
* Live chain writes consolidated in `e2e.blockchain.live.test.ts` (`describe.sequential`).

TESTS:

* `cd contracts && npm test` — 6/6 PASS
* blockchain encoding / service / event repository / e2e.blockchain / e2e.blockchain.live — PASS
* `npx tsc --noEmit` — PASS
* `npx prisma validate` — PASS

FILES CREATED:

* `backend/src/repositories/blockchainEvent.repository.ts`
* `backend/prisma/migrations/20260928120000_blockchain_event_logical_key/migration.sql`
* `backend/test/blockchain-event.repository.test.ts`
* `backend/test/blockchain.service.test.ts`
* `backend/test/qa/hardhat-global-setup.ts`

FILES MODIFIED:

* `backend/src/blockchain/BlockchainService.ts`
* `backend/prisma/schema.prisma`
* `backend/test/qa/hardhat.ts`
* `backend/test/qa/e2e.blockchain.live.test.ts`
* `backend/test/qa/e2e.blockchain.test.ts`
* `backend/test/qa/e2e.history.test.ts`
* `backend/test/corrections.test.ts`
* `backend/vitest.config.ts`
* `docs/PROJECT_STATUS.md`

KNOWN LIMITATIONS:

* HTTP verification/attestation → chain orchestration is NOT wired (TASK 2B).
* `GET /blockchain` remains 501.
* Correction/dispute/variation contract methods exist but are not called from application services yet.
* Live tests require Hardhat artifacts compiled under `contracts/artifacts`.

NEXT TASK:
TASK 3 — Derived Contractor Passport

---

## TASK 1

TASK:
Projects, Milestones & Ownership/IDOR

STATUS:
COMPLETE

Commit: `133a9b06db0eeba8d1dbf0818c9e98bc8999b6bf`

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

KNOWN LIMITATIONS:

* CLIENT / CONSULTANT_ENGINEER still have no project membership model; they cannot read or write another contractor's projects (403 / empty list).
* There is no `GET /api/v1/milestones` collection (only `GET /milestones/:milestoneId` and `GET /projects/:projectId/milestones`).

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
| Verification POST | COMPLETE | Internal MATCH is anchored through the application service when a writable registry is configured; other results never write |
| Attestation POST / GET | COMPLETE | Attestation is anchored when a writable registry is configured; GET is scoped by project access |
| Disputes POST/GET | PARTIAL | Create OPEN only; no resolve; no chain event |
| Corrections POST/GET | PARTIAL | Requires existing `BlockchainEvent`; HTTP never creates those |
| Variations | NOT IMPLEMENTED | GET/POST 501 |
| Passports | COMPLETE (TASK 3) | Derived read-only projection; authenticated list and project detail endpoints |
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

`backend/prisma/schema.prisma` plus migrations `20260924120000_init`, `20260924180000_evidence_versioning`, and `20260928120000_blockchain_event_logical_key`.

Models present: User, Contractor, Project, VerificationPolicy, Milestone, Evidence, EvidenceVersion, Verification, Attestation, BlockchainEvent, Dispute, Correction, ContractVariation, AuditLog.

No Passport table (ADR-0007). `BlockchainEvent` has unique `logicalKey`; confirmed proof is still implied by non-null `txHash` (no status enum).

---

## Blockchain (inspected)

- Contract: `contracts/contracts/ContractorProofRegistry.sol` (hash/id events only).
- Adapter: `backend/src/blockchain/BlockchainService.ts` (`registerProject`, `recordVerification`, `recordAttestation`) with `NonceManager` signer cache.
- Persistence helper: `blockchainEventRepository` (pending + confirm + logical-key idempotency).
- ABI also lists correction/dispute/resolution/variation; the service has no methods for those.
- Verification/attestation application services orchestrate writes through `BlockchainService` and `blockchainEventRepository`. `CONTRACT_ADDRESS` is empty in `.env.example`, so the default configuration returns no proof and keeps the off-chain workflow available.
- Proof writes persist a pending database event before EVM submission and confirm it only after a successful receipt. PostgreSQL and the EVM cannot share an atomic transaction: failed writes leave a pending event for retry/reconciliation. Verification comparison rows remain as the truthful MATCH result even if anchoring fails; the request returns an error and no proof is claimed. Attestations are deleted after chain failure so a client retry can recreate the business row; the pending proof event remains reusable via its logical key.
- Verification proof logical identity is `VERIFICATION:<projectId>:<evidenceVersionId>`. Attestation proof identity is `ATTESTATION:<projectId>:<evidenceId>:<verifierId>`. Only an explicit internal MATCH creates a VERIFICATION event; attestation approval creates only an ATTESTATION event.

---

## Tests (latest measured, TASK 3)

| Suite | Result |
| --- | --- |
| Targeted Passport + golden path | PASS (9/9) |
| `cd backend && npm test` | PASS (34 files, 214 tests) |
| `cd contracts && npm test` | PASS (6/6) |
| `cd backend && npx tsc --noEmit` | PASS |
| `cd backend && npx prisma validate` | PASS (existing Prisma package.json configuration deprecation warning) |

---

## KNOWN ISSUES

- Blockchain proofs are optional when no writable registry is configured; API returns `proof: null` and does not claim confirmation.
- `GET /blockchain`, GET/POST `/variations` return 501.
- Corrections require an existing `BlockchainEvent`; HTTP does not create those yet.
- Frontend public verify page is a stub; disputes/corrections pages are placeholders.
- Frontend register offers privileged roles; backend allows CONTRACTOR and CLIENT only.
- Pending BlockchainEvent rows are retained after chain submission failures for safe retry and reconciliation; an operator recovery workflow is not part of this task.

---

## NEXT TASK

Awaiting next assignment.

---

## TASK 3 — Derived Contractor Passport

STATUS: COMPLETE

IMPLEMENTATION:

* `GET /api/v1/passports` returns derived passports for the caller's accessible projects.
* `GET /api/v1/passports/:projectId` returns a derived project passport after `assertCanReadProject` authorization.
* The projection includes safe contractor/CRB fields, project and milestone details, evidence status, every evidence version and hash, persisted verification states, attestations with verifier role only, and VERIFICATION/ATTESTATION BlockchainEvents.
* Proofs are confirmed only when both transaction hash and positive block number exist. Pending/partial events are marked `PENDING`, `confirmed: false`; absent proofs are `null` or an empty collection.
* No Passport table, file contents/paths, verifier identifiers, credentials, or trust score were added.

TESTS:

* Targeted Passport tests cover authentication, owner access, cross-contractor denial, unknown projects, list scoping, all verification states, historical versions, attestations, confirmed and pending proofs, no-proof projections, and safe fields.
* The golden path now reads the passport after verification and attestation proofs are persisted.
* Final targeted/backend/TypeScript/Prisma/Hardhat results and commit hash are recorded in the Task 3 completion report.

KNOWN LIMITATIONS:

* Passport lists are not paginated.
* Passport is a database snapshot; it does not query EVM state or independently revalidate transactions.
