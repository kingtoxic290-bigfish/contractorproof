# ContractorProof Frontend Status

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