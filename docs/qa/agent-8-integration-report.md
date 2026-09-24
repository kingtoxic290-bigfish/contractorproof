============================================================
AGENT 8 QA / INTEGRATION REPORT
============================================================

STATUS:
READY WITH FINDINGS

BRANCH:
agent/qa

TEST ENVIRONMENT:
- Database: PostgreSQL 16 via Docker Compose (`localhost:5433`, Prisma `DATABASE_URL`)
- Backend: Express app through supertest (`vitest run` in `backend/`)
- Blockchain: local Hardhat JSON-RPC at `http://127.0.0.1:8545` (chainId 31337) plus injected/failing providers for negative tests
- Contract: `ContractorProofRegistry` (Solidity 0.8.24), deployed from compiled artifacts during live QA
- Storage: local `STORAGE_PATH` filesystem; objects removed in QA cleanup
- External adapters: `MockCrbIntegrationAdapter` / `MockNestIntegrationAdapter` (`source: SYNTHETIC_DEMO`)

TEST COUNTS:
- Unit: 25
- Integration: 23
- API: 119
- E2E: 17
- Blockchain: 18 (backend encoding/service/live + 6 Hardhat)
- Security/Regression: 26
- Total: 192 backend + 6 Hardhat + 73 frontend verification/passport

PASS:
192 backend, 6 Hardhat, 73 frontend verification/passport

FAIL:
0 red tests. Required golden HTTP path is incomplete — see Golden E2E and BLOCKERS.

BLOCKED:
3 capability gaps (HTTP proof orchestration, logical proof idempotency, official passport HTTP)

------------------------------------------------------------
CORE TEST RESULTS
------------------------------------------------------------

Authentication:
PASS

JWT Security:
PASS

RBAC:
PASS

401/403:
PASS

IDOR:
PASS

Ownership:
PASS

Evidence Lifecycle:
PASS

SHA-256 Integrity:
PASS

SHA-256 Encoding:
PASS

Policy:
PASS

Attestation Authorization:
PASS

MATCH:
PASS

MISMATCH:
PASS

Blockchain Proof:
FAIL

Blockchain Confirmation:
PASS

Blockchain Event Validation:
PASS

Blockchain Idempotency:
FAIL

Database Consistency:
PASS

Passport:
FAIL

Public Verification:
PASS

Tamper Test:
PASS

Golden E2E:
FAIL

Regression Suite:
PASS

------------------------------------------------------------
COMMANDS EXECUTED
------------------------------------------------------------

cd contracts && npx hardhat compile
cd backend && npx tsc --noEmit
cd backend && npx prisma validate
cd backend && npm test
cd contracts && npx hardhat test
cd frontend && npx tsc --noEmit -p tsconfig.app.json
cd frontend && npx vitest run src/features/verification src/features/passports src/tests/verification.test.tsx src/tests/passports.test.tsx

------------------------------------------------------------
FILES CREATED
------------------------------------------------------------

backend/test/qa/fixtures.ts
backend/test/qa/hardhat.ts
backend/test/qa/e2e.golden.test.ts
backend/test/qa/e2e.tamper.test.ts
backend/test/qa/e2e.security.test.ts
backend/test/qa/e2e.blockchain.test.ts
backend/test/qa/e2e.blockchain.live.test.ts
backend/test/qa/e2e.passport.test.ts
backend/test/qa/e2e.history.test.ts
backend/test/qa/e2e.stage2-authz.test.ts
backend/test/qa/e2e.uploads.test.ts
backend/test/qa/e2e.adapters.test.ts
backend/test/qa/e2e.errors.test.ts
backend/test/qa/e2e.verification-states.test.ts
backend/test/qa/unit.hash-encoding.test.ts
docs/qa/agent-8-integration-report.md

------------------------------------------------------------
FILES MODIFIED
------------------------------------------------------------

None of production `backend/src`, `contracts/`, or `frontend/src`

------------------------------------------------------------
FAILURES
------------------------------------------------------------

Test: E2E-001 golden ContractorProof lifecycle (full required path)
Component: Agent 2 HTTP orchestration + Agent 7 passport
Environment: backend supertest + PostgreSQL + local Hardhat
Expected: register → login → contractor → HTTP project/milestone → evidence → SHA-256 → policy → authorized attestation → BlockchainEvent PENDING → recordProof → receipt status 1 + VerificationRecorded → CONFIRMED → MATCH → passport → public MATCH
Actual: implemented slice passes through public MATCH. HTTP `POST /projects` and milestone create return 404/405. Authorized attestation does not create a BlockchainEvent or call BlockchainService. `GET /passports/:projectId` returns 501.
HTTP status: 404/405 (project create), 501 (passport)
Database state: Attestation row exists; BlockchainEvent count for the project is 0
Blockchain state: no application-submitted proof
Reproduction: run `backend/test/qa/e2e.golden.test.ts`
Severity: BLOCKER
Likely owning agent: Agent 2 (orchestration), Agent 7 (passport HTTP)
Recommended fix: after policy-satisfied authorized attestation, persist BlockchainEvent (txHash null), call BlockchainService.recordProof, require receipt.status == 1 and VerificationRecorded(eventId, projectId, evidenceHash), then persist txHash/blockNumber. Implement derived GET /passports without inventing scores.

Test: logical proof idempotency
Component: Prisma BlockchainEvent / Agent 2 proof submit
Environment: backend supertest + PostgreSQL
Expected: two requests for the same project + evidence version + logical proof do not create two independent proofs
Actual: no proof submit route. Two Prisma inserts of the same projectId + eventType + referenceId succeed as distinct rows. Attestation replay is 409 on (evidenceId, verifierId) only.
HTTP status: 404/405/501 on POST /blockchain
Database state: two BlockchainEvent rows, both txHash null
Blockchain state: none from HTTP
Reproduction: `backend/test/qa/e2e.blockchain.test.ts` E2E-006
Severity: BLOCKER
Likely owning agent: Agent 2
Recommended fix: unique logical key (projectId + evidenceVersionId + eventType, or equivalent) and idempotent submit. Do not key only on BlockchainEvent.id.

Test: official passport HTTP
Component: Agent 7
Environment: backend supertest
Expected: derived passport projection from real project/evidence/proof state; must not claim CONFIRMED when txHash is null
Actual: GET /api/v1/passports and GET /api/v1/passports/:projectId return 501. Frontend rejects a 200 body and does not invent trust/security scores.
HTTP status: 501
Database state: unchanged
Blockchain state: n/a
Reproduction: `backend/test/qa/e2e.passport.test.ts`
Severity: BLOCKER for golden path presentation
Likely owning agent: Agent 7
Recommended fix: derived projection only. If BlockchainEvent.txHash is null / missing receipt, do not present confirmed proof.

------------------------------------------------------------
CRITICAL FINDINGS
------------------------------------------------------------

1. Agent 2 has no attestation → blockchain proof orchestration. Authorized attestation does not create BlockchainEvent PENDING or call BlockchainService.recordProof. The architecture path attestation → receipt + VerificationRecorded → CONFIRMED cannot complete over HTTP. Classification: ARCHITECTURE GAP / BLOCKED. Owner: Agent 2. Agent 4 adapter is READY at service level.

2. Logical proof idempotency is not implemented. BlockchainEvent.id is the only identity. The same project + evidence version can insert two independent rows. Classification: BLOCKED. Owner: Agent 2.

3. Official passport HTTP is 501. Golden path cannot expose an approved public passport projection. Frontend correctly refuses to invent one. Classification: BLOCKED. Owner: Agent 7.

------------------------------------------------------------
NON-CRITICAL FINDINGS
------------------------------------------------------------

1. Stage 2 GET /api/v1/contractors and GET /api/v1/projects (and project milestones) are authenticate-only. Any JWT, including CLIENT and another CONTRACTOR, can read another contractor’s records. contracts.md documents this as current Stage 2. Evidence, verification, and attestation are ownership-scoped. Classification: DOCUMENTATION-ALIGNED CURRENT BEHAVIOR. Escalate to Agent 0 if the target ownership matrix is now required. No membership table was added.

2. POST /api/v1/projects and milestone create HTTP do not exist (404/405). QA seeds Prisma. Classification: EXPECTED for this slice / Agent 2 later.

3. CONTRACTOR POST /attestations is 403 at the role gate (`insufficient role` / FORBIDDEN), not always CONTRACTOR_ATTEST_FORBIDDEN. assertCanAttest still emits CONTRACTOR_ATTEST_FORBIDDEN, UPLOADER_ATTEST_FORBIDDEN, OWNER_ATTEST_FORBIDDEN, and ROLE_NOT_ALLOWED. Classification: EXPECTED BEHAVIOR / documentation nuance.

4. CLIENT / CONSULTANT_ENGINEER have no project membership. They receive 403 or empty lists. Classification: ARCHITECTURE GAP already recorded by Agent 6. Do not invent a membership table.

5. Variations HTTP is 501. Disputes/corrections are append-only application rows and do not write chain events. Corrections require an existing BlockchainEvent FK and do not rewrite it. Classification: EXPECTED.

6. BlockchainEvent has no PENDING/CONFIRMED column. Proof is implied by non-null txHash (ADR-0002). Live QA persisted txHash null then set txHash + blockNumber after a real receipt. Classification: DOCUMENTATION GAP if HTTP later needs an explicit status.

7. Internal verification of an unknown evidenceId returns 404 EVIDENCE_NOT_FOUND for privileged readers. Public POST /public/verify returns 200 UNAVAILABLE. Neither invents MATCH. Classification: EXPECTED HTTP-boundary vs compare-service split.

8. Empty EvidenceVersion.sha256 cannot be persisted (CHECK EvidenceVersion_sha256_hex_chk). Compare-time PENDING from a missing hash is unreachable after a successful upload. Upload verificationStatus remains PENDING until compare. Classification: EXPECTED / database integrity.

9. Path `../../../etc/passwd` is rejected as FILE_TYPE_NOT_ALLOWED (no allowed extension). `../../secret.txt` is stored under a UUID key with basename `secret.txt`. No filesystem escape. Classification: EXPECTED.

10. BlockchainService.getSignerContract() constructs a new Wallet per call. Sequential registerProject + recordProof on one service/provider instance failed with TRANSACTION_FAILED in live QA; a fresh BlockchainService instance succeeded. Classification: BUG (Agent 4), non-blocking because a new provider works, but HTTP orchestration must not share a stale nonce.

11. CRB/NeST adapters are SYNTHETIC_DEMO on success and miss. Classification: EXPECTED.

------------------------------------------------------------
BLOCKERS
------------------------------------------------------------

1. Cannot demonstrate a confirmed blockchain proof from the HTTP application. Do not treat the project as integrated until Agent 2 persists PENDING, calls BlockchainService, requires receipt.status == 1 plus VerificationRecorded(eventId, projectId, evidenceHash), then CONFIRMED — and rejects duplicates by a logical key, not only BlockchainEvent.id.

2. Official GET /passports remains 501, so the golden path cannot close on a derived passport.

------------------------------------------------------------
ARCHITECTURAL QUESTIONS
------------------------------------------------------------

1. Should Agent 2 add POST /projects and milestone create now, or keep Prisma seeding until a later slice?

2. Is Stage 2 authenticate-only GET for contractors/projects still accepted, or must Agent 2 apply the target ownership matrix before integration?

3. Confirm CLIENT/CONSULTANT access remains denied until a membership ADR — do not add a membership table without Agent 0.

4. Should BlockchainEvent gain an explicit PENDING/CONFIRMED status, or remain txHash == null vs txHash set?

5. Should Agent 2 register the project on-chain (registerProject) before recordVerification? The contract requires projectExists[projectId].

------------------------------------------------------------
OWNER ACTIONS
------------------------------------------------------------

Agent 2:
- Add attestation/policy → BlockchainEvent PENDING → BlockchainService.recordProof → CONFIRMED persistence.
- Add logical idempotency key for the same project + evidence version + proof type.
- Optionally add POST /projects and milestone create; tighten Stage 2 GET if Agent 0 requires it.
- Do not treat MATCH as attestation or automatic proof.

Agent 4:
- Adapter READY: live Hardhat deploy + recordProof + receipt.status == 1 + VerificationRecorded args + duplicate eventId → BLOCKCHAIN_DUPLICATE_PROOF.
- Fix sequential-write nonce/wallet reuse on one BlockchainService instance.
- HTTP owner remains Agent 2.

Agent 5:
- Evidence/verification lifecycle READY. Independent SHA-256 matches EvidenceVersion.sha256. MATCH ≠ attestation proven. Tamper → MISMATCH proven.

Agent 6:
- Auth/RBAC baseline preserved: 401/403, registration lock, Argon2id, JWT fail-closed, body impersonation ignored, IDOR on evidence/verification/attestation.

Agent 7:
- Passport HTTP still 501. Public verify PASS (MATCH/MISMATCH/UNAVAILABLE, no secrets). Frontend does not invent scores or rewrite MISMATCH → MATCH.

Agent 9:
- Stage 2 GET breadth and missing proof orchestration are in scope for security review.

------------------------------------------------------------
FINAL RECOMMENDATION
------------------------------------------------------------

FIXES REQUIRED
