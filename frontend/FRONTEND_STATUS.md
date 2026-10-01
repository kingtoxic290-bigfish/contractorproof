# ContractorProof Frontend Status

## MVP Role-Based UI and Workflow Alignment

The navigation now reflects the capabilities available to each role. CLIENT sees owned projects, contractor selection/reassignment, milestones, evidence visibility, and project Passport history, but no technical verification entry. CONTRACTOR sees assigned projects, milestones, evidence submission, and Passport history, without project creation, contractor assignment, or verification actions. AUDITOR and PROCUREMENT_OFFICER see the internal verification workflow. ADMIN retains the existing project and reviewer capabilities. Public navigation remains limited to Public Verification.

Public registration offers only CLIENT and CONTRACTOR. CONSULTANT_ENGINEER has no project-membership scope in the backend, so it is intentionally excluded from verification navigation and direct UI routes even though the backend role gate lists it; no backend access checks were bypassed.

Project creation and contractor assignment continue to use the existing endpoints. The backend derives CLIENT ownership from the signed-in identity, scopes `GET /api/v1/projects` to ownership/assignment, and checks the same relationship for project, milestone, evidence, and Passport reads. Project details no longer show client-only upload/review links or contractor verification links. The internal verification page now presents submitted evidence, technical comparison, and attestation as distinct supported stages.

Dispute, correction, variation, audit, and settings entries are removed from primary navigation while their unfinished routes remain explicitly unavailable/placeholders. No full workflows, external CRB/NeST integrations, public Passport, new role, schema, or blockchain capability were added. This UI alignment task makes no claim of live external CRB/NeST verification.

TESTS AND VALIDATION:

* Focused frontend role/workflow tests — 4 files, 57/57 tests PASS.
* Full frontend suite — 31 files, 248/248 tests PASS.
* Frontend ESLint and TypeScript/production build — PASS.
* Backend suite on the latest shared worktree — 37/38 files passed; 264/265 tests passed. `test/evidence-version.repository.test.ts` expects `crbSource` to be `SYNTHETIC_DEMO`, but the current schema returned `null` before a CRB check.
* Backend TypeScript build — BLOCKED by `backend/src/services/contractor.service.ts:27`: nullable `crbSource` conflicts with the non-null `PublicContractor.crbSource` type. This mismatch was not changed as part of frontend role alignment.
* Prisma schema validation — PASS.

KNOWN LIMITATIONS:

* Consultant project access remains unsupported pending a real project-membership/oversight model.
* Client review is not a separate action; attestation semantics remain those of the existing backend.
* Disputes, corrections, variations, audit, settings, evidence version append, and public Passport remain unavailable or incomplete.

## Role-Based UX and Project Assignment

Frontend project flows now reflect the backend role model. CONTRACTOR dashboards and project lists focus on assigned work, use the empty state “No projects have been assigned to you yet,” and do not expose project creation or milestone configuration. CLIENT dashboards and project lists focus on owned projects and show Create Project actions; project creation requires selecting a contractor from the backend directory. Project detail identifies the client and assigned contractor. CLIENT/ADMIN can reassign using the project-scoped backend operation, while contractor views do not expose assignment controls.

Role-aware navigation only exposes implemented routes that the role can use. Backend authorization remains authoritative; the router gates are usability checks, not security boundaries.

The authenticated server contracts are:

- `POST /api/v1/projects`: CLIENT/ADMIN only, with required `contractorId`. For CLIENT, ownership is derived from the JWT identity; body `clientId` is ignored.
- `PATCH /api/v1/projects/:projectId/contractor`: owning CLIENT/ADMIN only; the backend validates the contractor and reassigns current project access.
- `GET /api/v1/projects` and `GET /api/v1/projects/:projectId`: scoped to client ownership or contractor assignment, plus existing privileged oversight access.
- Project milestone creation: owning CLIENT/ADMIN only. Contractor evidence upload continues to require assignment-scoped access; verification remains a separate authorized reviewer action.

Tests and validation:

- Frontend: 31 test files, 242 tests PASS; ESLint and TypeScript/production build PASS.
- Backend: 37 test files, 254 tests PASS with two Vitest workers; backend TypeScript build and Prisma validation PASS.
- Hardhat registry: 6 tests PASS.
- Migration `20260929180000_client_project_ownership` applied locally and schema reports up to date.

Limitations: legacy projects have no client owner until explicitly assigned; reassignment replaces the current contractor and there is no separate assignment-history model. Project field edits, project deletion, milestone update/delete, and admin user/client management endpoints are not implemented.

## Task 10: End-to-end integration and demo validation

**Status: COMPLETE WITH LIVE-DEMO LIMITATIONS**

- The authenticated route sequence and API wiring were inspected across contractor, project, milestone, evidence, verification, proof, attestation, and Passport screens. Public `/verify` remains outside the authenticated shell and uses the public multipart verification endpoint.
- The complete frontend suite passed with 240/240 tests. It covers protected/public routing, login/error behavior, navigation, project and evidence context, SHA-256 rendering, canonical verification states, proof confirmation rules, attestation UI, Passport history, and public verification handling.
- The prior duplicate “Create Project” test finding is legitimate: a CLIENT sees both the sidebar navigation link and the dashboard’s primary action. The test now deliberately asserts two valid links; no product link was removed.
- A local PostgreSQL container is healthy. The Task 10 process could not keep backend/frontend development servers alive in this sandbox, and no enabled browser surface was available; no live browser journey, persistent-server API smoke, or real local-EVM transaction is claimed.

TESTS:

* Full frontend suite — 31 files, 240 tests PASS.
* Frontend lint and production build — PASS.
* Golden-path backend API regressions — 12 files, 116 tests PASS.
* Hardhat registry tests — 6 tests PASS.

KNOWN LIMITATIONS:

* `CONTRACT_ADDRESS` and `BLOCKCHAIN_PRIVATE_KEY` are unset in the local backend environment, and no JSON-RPC node is running. A writable blockchain proof demonstration was therefore not possible.
* Responsive inspection was limited to automated responsive layouts/tests; interactive desktop, tablet, and mobile browser validation was unavailable.

---

## Task 9: Public Verification UI

**Status: COMPLETE**

- The public `/verify` route remains outside the authenticated application shell (with `/public/verify` redirecting to it) and submits only to `POST /api/v1/public/verify`.
- The form sends backend-required multipart fields: a non-empty `file` and at least one UUID reference (`evidenceId` and/or `evidenceVersionId`). No browser-side hashing, proof lookup, or verification decision is performed.
- The UI strictly parses the public `{ data: { verification }, meta }` projection and permits only `MATCH`, `MISMATCH`, `PENDING`, and `UNAVAILABLE`. It displays the backend-supplied meaning and only the returned evidence-version reference.
- Blockchain proof is `CONFIRMED` only when the public response provides a transaction hash and positive block number. Otherwise it is explicitly not confirmed; no explorer URL or private/internal metadata is exposed.
- API, validation, server, rate-limit, and network failures are shown as request errors rather than being converted to `UNAVAILABLE`. Public requests use the shared API client with auth redirects suppressed.

TESTS:

* Focused public verification API/UI tests — 20/20 PASS.
* Full-suite, lint, build, and backend regression results are recorded in the Task 9 completion report.

KNOWN LIMITATIONS:

* The authoritative public contract does not return timestamps or event names, so the UI does not render either.
* Public proof data contains only confirmed transaction hash and block number; it is not treated as a statement about a contractor or underlying claim.

---

## TASK 11 — Security Audit Compatibility

STATUS: COMPLETE

Frontend review found no `dangerouslySetInnerHTML`, browser-side blockchain signing, embedded private key/RPC credential, or client-side authoritative hash/proof decision. Public verification uses a strict allow-listed response projection, and protected route visibility remains only a UX control; backend authorization is authoritative.

The client continues to surface the backend error envelope. Backend Task 11 standardizes authentication and validation failures on `{ error: { code, message, requestId } }`; frontend error parsing remains compatible. Existing limitation: the JWT is stored in localStorage, so XSS prevention remains important and replacing it with an HttpOnly-cookie session requires a separate architecture task.

---

## Agent 2 Task 6: Verification workflow

**Status: COMPLETE**

- Internal verification submission uses authenticated `POST /api/v1/verification` with JSON `evidenceId` and/or `evidenceVersionId`, or multipart fields `evidenceId`, `evidenceVersionId`, and optional `file`. The frontend does not set multipart boundaries or compute hashes.
- Evidence selection is scoped through the existing evidence list API. Reviewers may compare backend-stored bytes or submit a presented file as a separate verification action; upload never triggers verification.
- Responses are strictly parsed from `{ data: { verification, proof }, meta }`. Malformed canonical state, fields, hash, proof, or envelope produces an explicit data error. Backend HTTP errors and codes are preserved.
- Only `MATCH`, `MISMATCH`, `PENDING`, and `UNAVAILABLE` are accepted and shown. MATCH is not described as independent blockchain proof; MISMATCH is a technical comparison only. No local verification status, retry loop, score, or trust judgment is created.
- Persisted history is read from the existing authorized `GET /api/v1/passports` projection, in backend order, and associated with evidence versions and project/milestone context returned there. There is no `GET /api/v1/verification` endpoint. History and submission results remain separate views.
- Proof metadata returned with POST results and the passport projection is confirmed only when a transaction hash and positive block number are both present. Partial proof metadata remains PENDING; absent proof is shown as not returned. The frontend does not access an EVM or create transactions.
- Backend verification authorization allows ADMIN, AUDITOR, PROCUREMENT_OFFICER, CONSULTANT_ENGINEER, and CLIENT at the route gate; CONTRACTOR is denied. Project/evidence access is enforced by the backend. The frontend retains the shared 401 session behavior and presents 403/404/validation failures without bypassing access checks.

TESTS:

* Verification workflow tests include strict API envelope/state parsing, POST JSON/multipart contract and error propagation, history projection ordering/context, all four canonical statuses, empty/loading/malformed history, and confirmed/pending proof rules.
* Full frontend test suite and build results are recorded in the Task 6 closure commit/report.

KNOWN LIMITATIONS:

* No dedicated verification GET/history endpoint exists. Persisted history is available only through `GET /api/v1/passports`; that projection includes verification ID/state/source/time and version/project/milestone context, but not presented hash or a verification-specific reason DTO.
* Live backend verification is not claimed unless the local API health check and authenticated smoke request succeed.

Task 7 was not started. Public verification and blockchain history/reconciliation were not modified.

---

## Agent 2 Task 5: Milestones and Evidence

**Status: COMPLETE**

### Milestones

- Project details load milestones through `GET /api/v1/projects/:projectId/milestones`; create uses `POST` on the same project-scoped route.
- Creation sends the backend-supported `name`, optional `description`, and optional `policyId` fields, and unwraps the actual `{ data: { milestone }, meta }` response.
- Milestone names open the existing `GET /api/v1/milestones/:milestoneId` detail endpoint. Detail renders the backend `{ milestone }` response and links back to its project or to its evidence list.
- Project details expose project evidence, milestone creation, and each milestone list; list, detail, and create states use shared loading/error components and preserve backend authorization.

### Evidence

- Project and milestone views list evidence using `GET /api/v1/evidence?projectId=...` and `GET /api/v1/evidence?milestoneId=...`. Invalid URL/form identifiers produce a visible error and do not broaden the request.
- Upload uses the shared API client and `FormData` fields `milestoneId` and `file`. The frontend does not set a multipart boundary. Accepted extensions/MIME types and the 25 MiB limit mirror backend validation; the backend remains authoritative.
- The upload form obtains selectable projects and milestones from the existing APIs. A milestone-only context is resolved through its backend detail endpoint before submission. Successful upload presents the returned record and refreshes its evidence query.
- Evidence cards display backend fields only: evidence/milestone IDs, name, MIME type, size, creation timestamp, workflow status, comparison status, current version fields, and the complete canonical SHA-256. The full hash remains selectable and has a copy action.
- Upload is not represented as verification. The API currently returns `PENDING` for `verificationStatus`; the frontend displays the returned enum verbatim and creates no comparison result or trust state.

### Backend Contract Limits

- The evidence DTO contains `currentVersion`, not a versions array. The backend exposes no evidence detail or version-history route, so earlier versions cannot be displayed by this frontend. The current version remains visible and is not presented as a complete history.
- Evidence list DTOs do not contain project names or project IDs; the UI shows the backend milestone ID and the active project filter context rather than inventing associations.
- No backend files were changed. Backend authorization, validation, file restrictions, and access scoping remain authoritative.

### Validation

- `cd frontend && npm test -- --run` — 27 files passed, 190 tests passed.
- `cd frontend && npm run build` — passed, including TypeScript compilation.
- Browser layout inspection at 1440px desktop, 768px tablet, and 390px mobile found no page-level horizontal overflow. Long filenames and the full SHA-256 remained visible.
- Live backend smoke test — NOT RUN: `http://localhost:4000/health` refused the connection, so authenticated milestone/evidence CRUD could not be exercised.

### Task Boundary

Task 6 was not started. No verification actions, evidence replacement/version-history endpoint, or blockchain workflow was added.
