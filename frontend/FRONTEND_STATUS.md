# ContractorProof Frontend Status

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
