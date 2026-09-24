# Agent 0 Stage 2 Checkpoint

Status: Decision (2026-09-24)  
Owner: Agent 0 — Architect / Integration Lead  
Scope: Reconcile repository state after Agent 2 Stage 2 read APIs. No implementation in this checkpoint.

Authority if docs disagree: this file and `docs/architecture/adr/`.

Inspected: `backend/prisma/schema.prisma`, both Prisma migrations, live PostgreSQL, `docs/API.md`, `docs/api/contracts.md`, `docs/api/api-overview.md`, ADR-0004/0005/0006, frontend `asRecord` / `asRecordList` usages, contractor/project/milestone routes, existing Agent 5 evidence services, `StorageService`.

Git: `master` has no commits. `git diff` is empty. All files are untracked. There is no hidden committed schema.

---

## A. Canonical Prisma schema

`backend/prisma/schema.prisma` is canonical.

These models **exist now** and are **approved**:

| Model / enum | Present in `schema.prisma` | Verdict |
| --- | --- | --- |
| `EvidenceVersion` | Yes | Required. Agent 3. ADR-0005 |
| `Verification` | Yes | Required. Agent 3. `docs/database/data-model.md` |
| `VerificationStatus` | Yes | MATCH / MISMATCH / PENDING / UNAVAILABLE |
| `VerificationSource` | Yes | INTERNAL / PUBLIC |
| `Evidence.currentVersionId` | Yes | Pointer to current version |

Classification of `EvidenceVersion` and `Verification`:

- **A. Intentional.** Agent 3 Phase 2 work. Named in `docs/agents/agent-3-database.md`, ADR-0005, `docs/database/data-model.md`.
- **C. Required by specification.** Official lifecycle is validate → store → SHA-256 → `EvidenceVersion` → Evidence metadata → `Verification` compare.
- **Not B.** Not accidental. Not an unapproved Agent 2 edit. Agent 2 did not change Prisma in Stage 2.

Do **not** create another migration for these models. Do **not** edit `schema.prisma` in the Evidence HTTP slice.

---

## B. Canonical migration state

| Migration | Contents | Applied on live DB |
| --- | --- | --- |
| `20260924120000_init` | Base models. No `EvidenceVersion`. No `Verification`. | Yes (`2026-09-24 06:41:00 UTC`) |
| `20260924180000_evidence_versioning` | Adds both tables, both enums, `Evidence.currentVersionId`, CHECKs, backfill | Yes (`2026-09-24 07:51:52 UTC`) |

Live PostgreSQL (`localhost:5433`, database `contractorproof`) **does contain** tables `EvidenceVersion` and `Verification`. `_prisma_migrations` lists both migrations as finished.

Schema and migrations are aligned. Agent 2’s report that this slice made no migration changes is correct.

---

## C. Canonical API envelope

**Canonical success envelope for new domain APIs:**

```json
{ "data": { }, "meta": { } }
```

**Canonical error envelope for new domain APIs:**

```json
{ "error": { "code": "ERROR_CODE", "message": "Human-readable message", "requestId": "..." } }
```

Source: ADR-0004, `docs/api/api-overview.md`, `docs/architecture/integration-rules.md`, `docs/api/contracts.md`.

`data` is an **object** that holds named resources, not a bare array.

Examples that Agent 2 must follow for Evidence / Verification:

```json
{ "data": { "evidence": { "id": "…", "sha256": "…", "status": "PENDING_VERIFICATION" } }, "meta": {} }
```

```json
{ "data": { "evidence": [ ] }, "meta": {} }
```

```json
{ "data": { "verification": { "status": "MATCH", "evidenceVersionId": "…", "sha256": "…" } }, "meta": {} }
```

### What is not canonical

| Shape | Where it appears | Status |
| --- | --- | --- |
| `{ "contractors": [ ] }` / `{ "contractor": { } }` | Agent 2 Stage 2 + `docs/API.md` | Grandfathered Stage 2 deviation |
| `{ "projects": [ ] }` / `{ "project": { } }` | Same | Grandfathered Stage 2 deviation |
| `{ "milestones": [ ] }` | Same | Grandfathered Stage 2 deviation |
| Raw JSON array `[ ]` | Frontend `asRecordList(payload)` | Client parser, not a backend contract |
| `{ "data": [ ], "meta": { } }` | Not specified | Do not use. Resource name stays inside `data` |

Grandfathered until a coordinated Agent 1 + Agent 2 migration (same class as auth): health, auth, integrations, **and the five Stage 2 GET envelopes**.

`integration-rules.md` forbids a third shape. Agent 2 must **not** add `{ "evidence": [ ] }` or `{ "verification": { } }` at the top level.

Do not change Stage 2 envelopes in the Evidence slice. Do not change frontend parsers in the Evidence slice.

---

## D. Canonical role / read policy

Stage 2 implementation: the five GET endpoints use `authenticate` only. Any of the six login roles can read every contractor, project, and milestone. Route comments claiming “no role policy exists in the frozen specification” are **incorrect**.

The frozen read policy is **not** “every authenticated role.” It comes from:

1. ADR-0006: every implemented domain route uses authenticate + `authorize` + ownership where applicable.
2. `docs/architecture/authentication-model.md`: permission is role + ownership. No `Permission` table.
3. `docs/api/contracts.md` (exact lists below).
4. `docs/agents/agent-2-backend.md`: Agent 2 must apply those checks on implemented routes.

`docs/PROJECT_SPECIFICATION.md` does **not** define GET list scoping. It only forbids a contractor verifying or attesting their own evidence. Architecture docs win.

### Target read / write matrix (do not invent extras)

| Route | Roles / ownership (from `contracts.md`) |
| --- | --- |
| GET `/contractors` | ADMIN, AUDITOR, PROCUREMENT_OFFICER; CLIENT scoped; CONTRACTOR own only |
| GET `/contractors/:contractorId` | CONTRACTOR only if `contractor.userId === req.user.id`; privileged roles as above |
| GET `/projects` | Not fully enumerated. POST is CONTRACTOR (own contractor) + ADMIN. GET is ownership or privileged read |
| GET `/projects/:projectId` | Ownership or privileged read |
| GET `/projects/:projectId/milestones` | Same authorization as parent project |
| POST `/evidence` | CONTRACTOR (own project), ADMIN |
| GET `/evidence` | Project access |
| POST `/verification` | JWT; fingerprint compare only |
| POST `/attestations` | CONSULTANT_ENGINEER, CLIENT, PROCUREMENT_OFFICER, AUDITOR, ADMIN as allowed by policy. **`assertCanAttest` required.** CONTRACTOR → 403 |
| GET `/audit` | AUDITOR, ADMIN, PROCUREMENT_OFFICER |

`CONSULTANT_ENGINEER` is **not** listed on GET `/contractors` in `contracts.md`. Do not grant that access unless a later Agent 0 note adds it.

Stage 2 authenticate-only GETs are a **known deviation**. Do not retrofit them in the Evidence slice. Do not repeat authenticate-only on Evidence or Verification. Agent 6 still owns ownership helpers; they are not implemented yet except `assertCanAttest`.

---

## E. Evidence ownership

Agent 5 **already implemented** the domain services. Agent 2 must wire HTTP, not rebuild the pipeline.

| Concern | Owner | Current state | Agent 2 may |
| --- | --- | --- | --- |
| Prisma models / migration | Agent 3 | Done and applied | Read only |
| Repositories | Agent 3 | `evidence.repository.ts`, `evidenceVersion.repository.ts`, `verification.repository.ts` | Call only |
| `StorageService` / `LocalFilesystemStorageService` | Agent 5 | Implemented. Reuse | Call `save` / `read` / `remove` only through `EvidenceService` |
| File validation | Agent 5 | `services/evidence/validation.ts` | Do not duplicate |
| SHA-256 | Agent 5 | `hashEvidenceBytes` → `sha256Buffer` | Do not hash in the controller |
| Evidence + `EvidenceVersion` writes | Agent 5 | `EvidenceService.create` / `appendVersion` | Call the service |
| Verification compare + persist | Agent 5 | `VerificationService` | Call the service |
| Multipart receive + size cap | Agent 2 | Missing (`multer` not in `package.json`) | Add HTTP multipart only. Cap = `EVIDENCE_MAX_FILE_BYTES` (25 MiB) |
| Routes, envelope, status codes | Agent 2 | Evidence / verification routes are 501 | Implement |
| `authorize` + project ownership | Agent 6 + Agent 2 | Ownership helpers missing | Apply `contracts.md` checks; do not invent a second gate |
| `assertCanAttest` | Agent 6 | Function exists; unused by HTTP | Not part of Evidence slice |
| `POST /api/v1/public/verify` | Agent 7 | GET scaffold; POST 501 | Do not implement. Reuse Agent 5 compare later |

Agent 2 must not persist client-supplied storage keys or return `storageReference` / filesystem paths.

---

## F. Evidence / Verification dependency order

Official sequence (do not skip):

1. Contractors (Stage 2 HTTP done; envelope/authz deviations noted)
2. Projects (same)
3. Milestones (same; nested under project only)
4. **Evidence HTTP** ← next Agent 2 slice
5. EvidenceVersion (no separate public resource; created inside Evidence POST)
6. **Verification HTTP** (`/api/v1/verification`, singular)
7. Attestation (`assertCanAttest` + policy)
8. Disputes
9. Corrections
10. Variations
11. Passport (derived, Agent 7)
12. Blockchain anchoring (after policy-satisfied attestation)
13. Public verification POST (Agent 7, same compare function)
14. Audit HTTP (after writes exist)

`EvidenceVersion` is not a standalone Agent 2 milestone. Verification HTTP depends on Evidence create so a version and authoritative SHA-256 exist.

---

## G. Conflicts between current code and specification

| # | Conflict | Spec | Current code |
| --- | --- | --- | --- |
| 1 | Domain envelope | ADR-0004 `{ data, meta }` | Stage 2 `{ contractors \| projects \| milestones }` |
| 2 | Frontend parse | Agent 1 should consume `contracts.md` | `asRecordList` requires a top-level array. Stage 2 objects fail that parser |
| 3 | Read authz | ADR-0006 + `contracts.md` scoped reads | Authenticate-only for all six roles |
| 4 | Agent 2 route comments | Frozen policy exists | Comments say no role policy exists |
| 5 | `docs/API.md` vs `docs/api/contracts.md` | Target `{ data.contractor, meta }` | `docs/API.md` documents resource-keyed Stage 2 as current |
| 6 | Stale docs | Architecture freeze | `FRONTEND_API_REQUIREMENTS.md`, `api-overview.md`, `evidence-lifecycle.md` “model missing”, `system-overview.md` “domain APIs 501” |
| 7 | Verification path | Canonical `/api/v1/verification` | Stub remains `/api/v1/verifications` |
| 8 | Agent 6 Phase 2 | Ownership helpers + register lock-down | Helpers missing. Public register still not limited in this inspection’s route layer |

These are recorded, not redesigned. No silent third envelope.

---

## H. Exact next task for Agent 2

**Implement Evidence HTTP only.** Wire existing Agent 5 / Agent 3 code. Stop before Verification HTTP.

In scope:

1. Replace 501 on `POST /api/v1/evidence` and `GET /api/v1/evidence`.
2. Receive multipart (`milestoneId` + `file`). Limit = `EVIDENCE_MAX_FILE_BYTES`.
3. Call `evidenceService.create` / list methods. Do not reimplement validate, store, hash, or Prisma writes.
4. Return ADR-0004 envelopes: `{ data: { evidence }, meta }` and `{ data: { evidence: [] }, meta }`.
5. Apply `contracts.md` authz: POST = CONTRACTOR (own project) or ADMIN; GET = project access. 401 / 403 as specified.
6. Do not return `storageReference`, `storageKey`, or filesystem paths.
7. Keep `/api/v1/verifications` as 501 until the following Verification slice.

Out of scope for this next slice:

- Prisma / migrations
- Frontend
- Stage 2 envelope retrofit
- Stage 2 read-authz retrofit
- Verification HTTP
- Attestation, public verify, disputes, corrections, variations, passport, chain, audit
- A second storage or hash implementation

After Evidence HTTP is green, Agent 2’s following slice is Verification: retire `/verifications`, add `/api/v1/verification`, call `verificationService`. Agent 7 still owns public POST verify.
