# ContractorProof Frontend Status

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

---

## Task 12 — Final Presentation Polish & Demo Readiness

STATUS: COMPLETE WITH LIMITATIONS (browser-based visual inspection not performed; see Validation)

### Presentation work

**Shared design system**

- `src/components/ui/statusTone.ts` is now the single source of truth for state presentation. `MATCH`, `MISMATCH`, `PENDING` and `UNAVAILABLE` each resolve to one tone, one icon and one factual meaning sentence. Previously `StatusBadge` and `VerificationStatus` rendered the same four states with different colours (green/red versus teal/amber); that split is resolved. State names are unchanged and are never renamed.
- `Card`, `Section` and `Panel` now share one surface treatment (`CARD_SURFACE`) so border radius, padding and heading level no longer differ per component. `Card` accepts `headingLevel` and `actions`.
- `Button` gained `size` so control height is consistent per size; `primary` remains reserved for the single most important action on a screen.
- `StatusBadge` keeps an explicit text label and `aria-label`, so state is never conveyed by colour alone.
- New `Field` / `FieldGrid` / `HashValue` and `CopyButton` components give every record page the same labelled definition-list layout, and a consistent accessible copy-to-clipboard control.
- `src/utils/format.ts` adds presentation-only timestamp formatting and identifier shortening. It formats values the backend returned; it derives no new data.

**Navigation and context**

- New `Breadcrumbs` derives a trail from the current URL only, so it can never show a record that was not opened and makes no client-side authorization decision.
- New `RecordChain` shows where the current screen sits in CONTRACTOR → PROJECT → MILESTONE → EVIDENCE → VERIFICATION → PASSPORT, with `aria-current="step"` on the active stage.
- `PageContext` renders both in the application shell and emits nothing (and no stray spacing) where neither applies.
- Sidebar, mobile drawer and header share one focus treatment and brand colour; the mobile drawer is now a labelled modal with a close control.

**Evidence as an auditable record**

- `EvidenceCard` presents evidence identity, content type and size, recorded/last-updated timestamps, the SHA-256 fingerprint with an explicit explanation of what a hash does and does not prove, and the current version explicitly marked "Current version".
- Workflow state and fingerprint-comparison state are shown side by side and labelled separately; they are never merged into one judgement.
- Each card links forward to its milestone, to verification for that evidence, and to the rest of the milestone's evidence.
- No filesystem path, storage implementation detail or invented field is displayed.

**Verification, blockchain and public verification**

- The four verification states are rendered from the shared tone module, so internal and public verification agree visually.
- `PublicVerificationResult` states plainly when the response carries no confirmed transaction hash and block number, and says that blockchain anchors integrity rather than being the system of record.
- `PublicVerificationPage` gained a page heading, a visible four-step workflow, per-field validation, `aria-busy` on submit, and moves focus to the result region when a result arrives. It remains unauthenticated.

**Loading, empty and error states**

- `LoadingState`, `EmptyState` and `ErrorState` were standardised (shared surface, sizes, tone, optional empty-state action). Empty states say the service returned no records; they never imply a record is absent from the system. No raw JSON or server detail is rendered.

**404**

- `NotFoundPage` replaces the previous silent `path="*"` → `/dashboard` redirect, for both the public and authenticated route trees. An unknown address is now reported as such.

### Business semantics preserved

- The four verification states, their names, and their factual meanings are unchanged.
- No API contract, backend file, database model, authorization rule or blockchain semantic was modified.
- No trust, reputation, risk, reliability or ranking score, and no "trusted/safe contractor" claim was introduced.
- No fixture, hash, transaction, block number or explorer URL was invented. Proof is shown only when the response confirms it.
- No test was rewritten to make a change pass.

### Validation

- `cd frontend && npm run lint` — passed.
- `cd frontend && npm test -- --run` — 31 files passed, 242 tests passed.
- `cd frontend && npm run build` — passed, including TypeScript compilation.
- `cd backend && npm test` — 37 files passed, 254 tests passed (unchanged by this task; no backend file was edited).
- `cd contracts && npx hardhat test` — 6 passing.
- Browser: pages were rendered in headless Chrome from a Vite dev server and the resulting DOM was inspected. Verified for `/login`, `/verify` and an unknown route: correct single `h1` per page, labelled form controls, the 404 screen renders instead of redirecting, and no horizontal overflow at 360, 390, 768 or 1280 CSS pixels.
- NOT PERFORMED: live browser *visual* inspection. Screenshots were captured but this environment cannot perceive images, so no claim is made about visual appearance, spacing or contrast as rendered. Authenticated screens were exercised by the automated suite (jsdom), not in a browser, because the local backend was not started.

### Known limitations

- Authenticated pages were not opened in a real browser; the API, database and seed data were not started or created.
- The evidence DTO exposes only `currentVersion`, so the evidence screen cannot show a version history. The passport projection is the only place historical versions appear.
- Timestamps are formatted for display but the passport and variation records still render some raw backend timestamps; those pages were outside this task's staging scope.
