# ContractorProof — Project Status Ledger

This file is the Agent 1 task ledger. Update it after every task. Use only COMPLETE, PARTIAL, or BLOCKED.

## CURRENT TASK

TASK 8 — Contractor Passport UI

## STATUS

COMPLETE

The existing Passport list/detail routes now use the authenticated backend-derived project Passport projection. The frontend calls `GET /api/v1/passports` and `GET /api/v1/passports/:projectId`, strictly parses their documented `data.passports` and `data.passport` envelopes, and preserves the existing shared loading, empty, error, retry, and authorization handling.

The project Passport displays returned contractor/project metadata, milestones, evidence records, every ordered version and SHA-256, canonical verification history, attestations, related proof, corrections with original/corrected versions and resolutions, variation snapshots/resolutions, and dated record history. No trust, reputation, safety, or risk score is produced; `MISMATCH` remains a technical comparison result. Historical versions are rendered separately and are not overwritten.

TESTS:

* Passport API and UI tests — 19/19 PASS
* Relevant backend Passport regressions — 8/8 PASS
* Frontend lint — PASS
* Frontend TypeScript/production build — PASS
* Full frontend suite with `VITE_API_ORIGIN=http://127.0.0.1:65534 npm test` — 29/29 files, 213/213 PASS.
* Plain `npm test` with the local backend active returned 211/213 because an existing milestone-create test issues an unmocked project read with a seeded fake token, receives a live 401, and reaches the session-expired screen. It passes with the API origin isolated; Task 8 does not change that workflow.

KNOWN LIMITATIONS:

* Passport evidence DTOs do not include filenames or MIME/size metadata; the UI therefore identifies evidence by returned IDs.
* Disputes are not included in the current Passport DTO. The UI does not join a separate disputes endpoint into this derived record.
* Live `GET /health` returned HTTP 200 and unauthenticated `GET /api/v1/passports` returned HTTP 401 as expected. The protected Passport page redirected to sign-in in the browser because no user bearer token was available; authenticated visual rendering and live CRUD behavior are not claimed.

---

## TASK 5.5 — UI polish, icon system, and visual refinement

## STATUS

COMPLETE

The frontend presentation layer now uses the existing `lucide-react` icon library for a more consistent, professional, and readable contractor verification interface. Shared navigation, summary cards, status badges, empty/loading/error states, and the evidence upload panel were refined without modifying API contracts, backend routes, authorization, or verification logic.

Major improvements include:

* stronger active/inactive sidebar navigation with semantic icons
* reusable card and page-header polish for consistent layout hierarchy
* icon-bearing status styling for canonical verification states
* improved dashboard summaries and attention-state presentation
* clearer evidence upload UI with upload affordances and readable selected-file metadata

TESTS:

* Full frontend suite (`cd frontend && npm test -- --run`) — PASS (217/217 tests)
* Frontend production build (`cd frontend && npm run build`) — PASS

KNOWN LIMITATIONS:

* This task is presentation-only; no backend contracts, permissions, or business rules were altered.
* Live backend smoke verification was not run because the backend service was unavailable in this environment.

---

## TASK 7 — Blockchain Proof & Attestation UI

## STATUS

COMPLETE

The frontend proof and attestation workflow is wired to the real backend contracts already implemented in the service layer. The verification result remains the authoritative source for `MATCH`, `MISMATCH`, `PENDING`, and `UNAVAILABLE` values; blockchain proof is shown only when `POST /api/v1/verification` returns `data.proof`, and attestation creation is handled through `POST /api/v1/attestations` only for roles allowed by the backend.

The UI distinguishes verification from blockchain proof from attestation rather than collapsing them into a single outcome. `CONFIRMED` is shown only for a returned transaction hash with a positive block number; partial transaction metadata stays `PENDING`, and a missing proof is displayed as `NO PROOF`. `MISMATCH` does not imply fraud or unsafe status; it only means the submitted fingerprint did not match the authoritative record.

TESTS:

* Focused verification, proof, and attestation UI tests — PASS
* Full frontend suite (`cd frontend && npm test -- --run`) — PASS
* Production build (`cd frontend && npm run build`) — PASS
* Existing backend verification/attestation regressions remain unchanged because no backend code was modified

KNOWN LIMITATIONS:

* The backend exposes `GET /api/v1/attestations` for authorized readers, but the Task 7 UI intentionally keeps the surface focused on the current attestation action instead of fabricating a prior-attestation history list.
* `GET /api/v1/blockchain` is a backend history route, but the Task 7 UI shows only the proof metadata returned by the verification contract and does not invent a standalone blockchain history screen.
* No private keys, provider configuration, or storage paths are displayed.

---

## TASK 6 — Variations Lifecycle

## STATUS

COMPLETE

`ContractVariation` now captures immutable original/proposed project and optional milestone snapshots. A separate `VariationResolution` records the decision, note, resolver, and time. Approval applies the proposed fields and records the resolution in one PostgreSQL transaction; rejection preserves the original current state. The original project/milestone values remain recoverable from the variation snapshot. Evidence, versions, verification rows, and prior proof events are referenced/preserved and never rewritten.

Routes: `POST/GET /api/v1/variations`, `GET /:variationId`, `POST /:variationId/review`, and `POST /:variationId/resolve`. Contractors create and read only on their projects; ADMIN/AUDITOR/PROCUREMENT_OFFICER can read and resolve using existing project access. Distinct variations are allowed, while `(projectId, variationReference)` uniqueness preserves the existing domain rule. Identical resolution retries are idempotent; conflicting resolutions return 409.

The existing `recordVariation` contract method is now called through `BlockchainService` and proof orchestration. Approved variations with a confirmed source event create a pending `BlockchainEvent` before submission, and only successful receipts with a transaction hash and block number become confirmed. Failure leaves a pending event for retry; an unconfirmed source does not create a variation proof. The derived Passport includes original/proposed snapshots, decision, related evidence, and source/variation proof state. No Passport table or contract change was introduced.

TESTS:

* Focused variations — 8/8 PASS
* Correction, dispute, Passport, verification/attestation and history regressions — 92/92 PASS
* Full backend (`npm test -- --maxWorkers=2 --minWorkers=1`) — 240/240 PASS
* `npx tsc --noEmit` — PASS
* `npx prisma validate` — PASS (existing Prisma package config deprecation warning)
* Hardhat — 6/6 PASS; live backend Hardhat BlockchainService tests — 3/3 PASS

KNOWN LIMITATIONS: project/milestone fields supported by variations are limited to the explicitly validated allowlists. Evidence is referenced rather than edited by a variation; new evidence continues through the existing upload/version workflow. Any legacy variation rows from the pre-lifecycle schema are marked with unavailable snapshot metadata because that schema stored no before/after state.

Commit hash is reported in the Task 6 completion report.

---

## AGENT 2 TASK 5 — Milestones + Evidence Frontend Workflow

## STATUS

COMPLETE

The frontend now completes the project-to-milestone-to-evidence workflow against the existing backend contracts. Project detail lists project-scoped milestones and provides direct access to project evidence and milestone creation. Milestone detail uses the existing authenticated `GET /api/v1/milestones/:milestoneId` route; no new backend endpoint was introduced.

Evidence listing uses the backend's project and milestone query filters. Upload sends multipart `milestoneId` and `file` fields through the shared API client, displays the returned evidence/current-version DTO, and refreshes the active list. Responses are strictly parsed, including the canonical SHA-256 and the backend verification enum. Upload is not verification; no comparison action, result, trust score, or Task 6 route was added.

Authorization remains backend-authoritative. CONTRACTOR and ADMIN are the only roles offered upload controls, matching `EVIDENCE_UPLOAD`; 401 continues through the shared session-expiration mechanism, 403 does not clear the session, and 404 is rendered as not found. Invalid evidence URL filters are rejected visibly instead of being dropped into an unfiltered request.

TESTS:

* Focused milestone/evidence API and UI tests cover list/create/detail contracts, empty/malformed responses, upload FormData fields, local/backend validation, success refresh, SHA-256/current version display, persisted status display, and 401/403/404 handling.
* `cd frontend && npm test -- --run` — 27/27 files, 190/190 tests PASS.
* `cd frontend && npm run build` — PASS, including TypeScript compilation.
* Browser layout inspection at 1440px, 768px, and 390px — PASS; no page-level horizontal overflow.

KNOWN LIMITATIONS:

* Evidence list/create responses expose only `currentVersion`; no evidence detail or version-history API is mounted, so earlier version records are unavailable to the frontend.
* Evidence DTOs do not include project names/IDs. The frontend displays the returned milestone ID and project filter context only.
* Live backend smoke testing was NOT RUN because `http://localhost:4000/health` refused the connection. No backend files were modified.

TASK 6 STATUS: NOT STARTED.

---

## AGENT 2 TASK 6 — Verification Frontend Workflow

## STATUS

COMPLETE

The protected verification UI submits internal comparisons through the existing authenticated `POST /api/v1/verification` route. It sends `evidenceId` and/or `evidenceVersionId` as JSON for a stored-byte comparison, or the same references plus optional multipart `file` for a presented-file comparison. The backend performs comparison and persistence; the frontend does not hash or decide results.

The UI accepts only `MATCH`, `MISMATCH`, `PENDING`, and `UNAVAILABLE`, displays the returned comparison and evidence/version context, and keeps verification separate from evidence upload and attestation. Backend response parsing is strict; malformed envelopes, statuses, timestamps, hashes, or proof data are surfaced as errors. Backend 400/401/403/404/409/422 semantics are preserved through the shared API client.

Persisted history uses the existing authenticated `GET /api/v1/passports` projection because no verification GET endpoint is mounted. Records are rendered in the backend-provided order with returned project/milestone/evidence-version metadata. Blockchain proof is confirmed only when the response includes both a transaction hash and a positive block number; partial metadata is pending and absent proof is explicitly absent. The browser never queries the EVM or submits transactions.

TESTS:

* Verification submission API tests cover the real JSON and multipart POST shapes, response envelope/state parsing, malformed records, and backend error propagation.
* Verification UI/history tests cover canonical statuses, loading/empty/error/malformed states, persisted history order and context, proof confirmation rules, and evidence-upload separation.
* Full frontend suite/build results are recorded with the Task 6 commit.

KNOWN LIMITATIONS:

* There is no `GET /api/v1/verification` route. History comes from `GET /api/v1/passports` and only includes its documented projection fields; it does not provide presented hashes or detailed reason codes.
* Live backend smoke testing is not claimed unless the local backend is reachable and authenticated verification can be exercised.

BACKEND FILES MODIFIED: none.

TASK 7 STATUS: NOT STARTED.

---

## AGENT 2 TASK 4 — Contractors + Projects Frontend Workflow

## STATUS

COMPLETE

The contractor and project frontend flows are now backed by the real backend contracts instead of placeholder or synthetic records. Contractor list/detail screens call the authenticated contractor endpoints; project list/detail screens call the authenticated project endpoints; the create-project form uses the real `POST /api/v1/projects` route and preserves the backend's required-field and access rules. Role gating remains aligned to the backend contract: only `CONTRACTOR` and `ADMIN` users can access the create-project route, while the backend enforces ownership and validation rules.

TESTS:

* `cd frontend && npm test -- --run` — 168/168 PASS
* `cd frontend && npm run build` — PASS

KNOWN LIMITATIONS:

* The frontend continues to rely on the backend as the authoritative source for authorization and response shapes; no fake project or contractor data was introduced.
* Live smoke testing against a local backend instance was not run in this environment, so verification remains at the frontend test/build level.

---

## AGENT 2 TASK 3 — Real Evidence Verification Dashboard

## STATUS

COMPLETE

The protected frontend dashboard now uses the authenticated `GET /api/v1/passports` projection. It composes accessible projects, milestones, evidence, verification history, attestations, and proof state from the backend response, preserving the backend's authorization scope. The dashboard uses no fabricated records or metrics and adds no backend endpoint or backend code.

Summary counts are derived from the returned records. Verification states remain `MATCH`, `MISMATCH`, `PENDING`, and `UNAVAILABLE`. Recent activity is composed from timestamped records in the response. Project, activity, and attention links use the existing project detail route. Confirmed and pending proof are distinguished using the passport's persisted proof fields; projects with no returned proof events are shown as having no proof.

Loading, successful-empty, malformed-response, and API error states are distinct. A 403 remains an authorization state without clearing the authenticated session. The dashboard does not use the verification POST endpoint as a read or call the unimplemented blockchain list endpoint.

TESTS:

* Dashboard/API tests — 7/7 PASS
* Full frontend (`cd frontend && npm test -- --run`) — 164/164 PASS
* Production build (`cd frontend && npm run build`) — PASS, including TypeScript compilation
* Desktop and 390px browser preview — PASS; no horizontal page overflow

KNOWN LIMITATIONS: local backend health check on port 4000 was unavailable, so live database-backed smoke testing was not possible. Verification and proof summaries include only records returned by the existing passport projection.

BACKEND FILES MODIFIED: none for Task 3.

---

## TASK 2 — Frontend Authentication + Typed API Client

## STATUS

COMPLETE

The frontend is integrated with the backend authentication contract and uses a centralized typed API client that respects the existing `/api/v1` base, bearer-token format, JSON envelope handling, and role-based authorization model. The flow remains aligned to the backend: login/register via `/auth/*`, the authenticated user via `/auth/me`, token storage in the existing session utility, and route protection through the existing auth provider and guards.

TESTS:

* `cd frontend && npm test -- --run` — PASS (157/157 tests)
* `cd frontend && npm run build` — PASS

FILES MODIFIED:

* `frontend/src/services/api/client.ts`
* `frontend/src/services/api/auth.ts`
* `frontend/src/services/api/errors.ts`
* `frontend/src/features/auth/AuthContext.tsx`
* `frontend/src/features/auth/ProtectedRoute.tsx`
* `frontend/src/features/auth/GuestRoute.tsx`
* `frontend/src/pages/LoginPage.tsx`
* `frontend/src/types/auth.ts`
* `frontend/src/types/roles.ts`

KNOWN LIMITATIONS:

* Task 2 establishes the shared client and auth flow only; it does not implement the dashboard or feature-page data integration work that belongs to later tasks.
* Backend authorization remains authoritative; the frontend continues to use role checks only for UI visibility and navigation.

NEXT TASK:
TASK 3 — Dashboard Integration

---

## TASK 1 — Frontend Design System + App Shell

## STATUS

COMPLETE

A reusable ContractorProof design system and application shell were established without changing routes, auth behavior, or backend APIs. The frontend now has a stronger visual foundation based on restrained enterprise colors, typography, spacing, card/layout primitives, navigation, status badges, and responsive shell patterns. Reusable components include `Button`, `Card`, `PageHeader`, `PageContainer`, `Section`, `Panel`, `DataTable`, and improved empty/loading/error states.

TESTS:

* `cd frontend && npm test -- --run` — PASS (157/157 tests)
* `cd frontend && npm run build` — PASS

FILES CREATED:

* `frontend/src/components/ui/PageContainer.tsx`
* `frontend/src/components/ui/Section.tsx`
* `frontend/src/components/ui/DataTable.tsx`
* `frontend/src/components/ui/Panel.tsx`

FILES MODIFIED:

* `frontend/src/styles/index.css`
* `frontend/src/components/ui/Button.tsx`
* `frontend/src/components/ui/Card.tsx`
* `frontend/src/components/ui/PageHeader.tsx`
* `frontend/src/components/ui/StatusBadge.tsx`
* `frontend/src/components/feedback/EmptyState.tsx`
* `frontend/src/components/feedback/LoadingState.tsx`
* `frontend/src/components/feedback/ErrorState.tsx`
* `frontend/src/components/layout/AppShell.tsx`
* `frontend/src/components/layout/Header.tsx`
* `frontend/src/components/layout/PublicLayout.tsx`
* `frontend/src/components/layout/Sidebar.tsx`
* `frontend/src/components/navigation/navConfig.ts`

KNOWN LIMITATIONS:

* This task intentionally does not implement dashboard data integration or backend feature flows; it only establishes the visual foundation and shell.
* Future task-specific UI work should build on the new reusable primitives without altering the existing route and auth architecture.

NEXT TASK:
TASK 2 — Authentication + API Client

---

## CURRENT TASK

TASK 5 — Corrections Lifecycle

## STATUS

COMPLETE

Corrections lifecycle details and test results are recorded below.

---

## TASK 5 — Corrections Lifecycle

## STATUS

COMPLETE

Corrections now support create/list/detail, review, and resolution. Status transitions are OPEN →
UNDER_REVIEW → APPROVED/REJECTED. A separate `CorrectionResolution` preserves outcome, note,
resolver, timestamp, and optional corrected EvidenceVersion. Distinct correction requests remain
allowed; an identical resolution retry returns the stored row and conflicting outcomes return 409.

For VERIFICATION source events, the original EvidenceVersion is linked and validated against the
milestone. A resolved approved correction links a version from the corrected evidence, which can
be a separate Evidence row or a later version of the original. Original versions, hashes,
Verification rows, and BlockchainEvents remain available. Evidence.currentVersionId advances only
when the existing Evidence row itself receives a new version.

Authorization reuses existing project helpers and permission roles. Contractors are limited to
their projects; ADMIN, AUDITOR, and PROCUREMENT_OFFICER use established privileged read/resolution
access. Corrections appear in the derived Passport with original proof/version, corrected versions,
resolution history, and correction proof. No Passport table was added.

Blockchain anchoring uses the existing contract `recordCorrection` method after approval only when
the original event is confirmed and a corrected EvidenceVersion is linked. Pending rows remain
explicitly pending after RPC/transaction/confirmation failure; a matching resolution retry reuses
the pending event and may confirm it after recovery. No fake proof is reported, and the contract
was not changed.

TESTS:

* Focused correction suite — 28/28 PASS
* Dispute regression — 25/25 PASS
* Passport regression — 8/8 PASS
* Full backend (`npm test -- --maxWorkers=2 --minWorkers=1`) — 232/232 PASS
* `npx tsc --noEmit` — PASS
* `npx prisma validate` — PASS (existing Prisma package config deprecation warning)
* Hardhat — 6/6 PASS; live backend Hardhat BlockchainService tests — 3/3 PASS

KNOWN LIMITATIONS:

* Appending a version on the original Evidence row advances its current-version metadata under the
  existing version model; the original EvidenceVersion and verification history remain immutable.
* Blockchain correction proofs require a confirmed original event and an approved corrected
  EvidenceVersion. Project-information corrections without evidence remain database-only.

Commit hash is reported in the Task 5 completion report.

---

## TASK 4 — Dispute Lifecycle

STATUS: COMPLETE

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
