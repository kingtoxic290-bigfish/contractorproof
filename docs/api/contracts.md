# API Contracts

Status: frozen shapes for implementation. Not all endpoints must be built now.  
Existing working payloads are listed as **current**. New work uses **target** envelopes.

`requestId` is generated per request by Agent 2 middleware.

---

## Health (current, grandfathered)

`GET /health` and `GET /api/v1/health`  
Auth: none

```json
{ "status": "ok", "service": "contractorproof-api" }
```

---

## Auth (current, grandfathered until P1 migration)

### POST `/api/v1/auth/register`

Auth: none  
Allowed `role` after Agent 6: `CONTRACTOR` | `CLIENT` only  
`ADMIN` remains forbidden. Other privileged roles become 400.

Request:

```json
{ "email": "user@example.com", "password": "password123", "fullName": "Example User", "role": "CONTRACTOR" }
```

Current response 201: `{ "token": "jwt", "user": { "id", "email", "fullName", "role" } }`  
Errors current: `{ "error": "message" }` (400, 409)

### POST `/api/v1/auth/login`

Auth: none  
Request: `{ "email", "password" }`  
Current response: `{ "token", "user" }`  
401: `{ "error": "invalid email or password" }`

### GET `/api/v1/auth/me`

Auth: JWT  
Current response: `{ "user": { "id", "email", "fullName", "role" } }`

---

## Users (target, not implemented)

### POST `/api/v1/users`

Auth: JWT  
Role: ADMIN  
Purpose: provision privileged users  
Request data: `{ "email", "password", "fullName", "role" }` with role in the six-role enum  
Response: `{ "data": { "user": { "id", "email", "fullName", "role" } }, "meta": {} }`  
Do not return password hashes.

---

## Contractors

### Current Stage 2 GET (implemented)

Auth: JWT via `authenticate` only. No extra role filter.  
Envelope: grandfathered collection/detail objects (not `{ data, meta }`).  
`user` is `PublicUser`. `passwordHash` is never returned.

`GET /api/v1/contractors` 200: `{ "contractors": [PublicContractor] }`  
Empty 200: `{ "contractors": [] }`  
401: `{ "error": "missing bearer token" }` or `{ "error": "invalid or expired token" }`

`GET /api/v1/contractors/:contractorId` 200: `{ "contractor": PublicContractor }`  
400: `{ "error": "contractorId must be a valid UUID" }`  
404: `{ "error": "contractor not found" }`

### Target (later)

Roles: ADMIN, AUDITOR, PROCUREMENT_OFFICER, CLIENT (scoped), CONTRACTOR (own only).  
Ownership: CONTRACTOR only if `contractor.userId === req.user.id`.  
Future envelope may move to `{ data, meta }`. Not implemented now.

---

## Projects and milestones

### Current Stage 2 GET (implemented)

Auth: JWT via `authenticate` only. No extra role filter.  
Fields are Prisma columns only.

`GET /api/v1/projects` 200: `{ "projects": [PublicProject] }`  
Empty 200: `{ "projects": [] }`

`GET /api/v1/projects/:projectId` 200: `{ "project": PublicProject }`  
400: `{ "error": "projectId must be a valid UUID" }`  
404: `{ "error": "project not found" }`

`GET /api/v1/projects/:projectId/milestones` 200: `{ "milestones": [PublicMilestone] }`  
Empty 200 when the project exists: `{ "milestones": [] }`  
404 when the project does not exist.

There is no `GET /api/v1/milestones`.

### Target (later)

POST `/api/v1/projects` roles: CONTRACTOR (own contractor), ADMIN  
POST body: `{ "name", "description?", nest fields? }`  
CONTRACTOR `contractorId` comes from the session profile, not from a client-supplied foreign id (IDOR).

GET `/api/v1/projects/:projectId`: ownership or privileged read.

GET|POST `/api/v1/projects/:projectId/milestones`  
POST body: `{ "name", "description?", "policyId?" }`

GET `/api/v1/milestones/:milestoneId`: same authorization as parent project. Not implemented.

---

## Evidence (current Stage 3 HTTP)

Envelope: `{ "data": { "evidence": {} | [] }, "meta": {} }`  
Not `{ "evidence": {} }` and not the Stage 2 resource-keyed collections.

Auth 401 stays grandfathered: `{ "error": "missing bearer token" }`.  
Domain errors use `{ "error": { "code", "message", "requestId" } }`.

Identity (`uploadedById`) comes from the JWT session. Client-supplied hashes and storage keys are ignored.  
Responses never include `storageKey`, `storageReference`, or filesystem paths.

Multipart limit: `EVIDENCE_MAX_FILE_BYTES`. Domain validation (MIME/extension/hash/store) is Agent 5.

### POST `/api/v1/evidence`

Auth: JWT  
Roles: CONTRACTOR (milestone must belong to that contractor's project), ADMIN  
ADMIN bypasses ownership only — not file validation, hashing, or persistence rules.  
Content-Type: multipart  
Fields: `milestoneId`, `file`  
Behavior: authenticate → authorize → ownership → `evidenceService.create`  
201: `{ "data": { "evidence": { "id", "milestoneId", "currentVersionId", "fileName", "sha256", "status": "PENDING_VERIFICATION", "verificationStatus": "PENDING", ... } }, "meta": {} }`

`status` is workflow only. Do not store MATCH / MISMATCH on Evidence.

400: missing file, missing/invalid `milestoneId`, empty file, oversized file, disallowed type  
403: wrong role, or CONTRACTOR using another contractor's `milestoneId`  
404: ADMIN + unknown milestone

There is no `GET /api/v1/evidence/:id`, version API, or download API in this slice.

### GET `/api/v1/evidence`

Auth: JWT  
Query: optional `milestoneId` and/or `projectId`  
Authz: project access, enforced in the SQL `where` clause  

| Role | Visible evidence |
| --- | --- |
| ADMIN, AUDITOR, PROCUREMENT_OFFICER | All (optionally filtered) |
| CONTRACTOR | Own projects only |
| CLIENT, CONSULTANT_ENGINEER | None until Agent 6 defines membership (`[]`) |

200: `{ "data": { "evidence": [ ... ] }, "meta": {} }`  
Empty accessible set: `{ "data": { "evidence": [] }, "meta": {} }`

---

## Verification (current Stage 4 HTTP)

Canonical family: `/api/v1/verification` (singular).  
`/api/v1/verifications` is retired. Do not register both.

### POST `/api/v1/verification`

Auth: JWT  
Roles allowed through the role gate: ADMIN, AUDITOR, PROCUREMENT_OFFICER, CONSULTANT_ENGINEER, CLIENT.  
**CONTRACTOR is forbidden**, including self-verification of own evidence and attempts against another contractor’s evidence.  
Project access is still required. Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CLIENT / CONSULTANT_ENGINEER have no membership model yet → 403.

Body: JSON or multipart with `evidenceId` and/or `evidenceVersionId` (UUID). Optional `file`.  
Client-supplied `source` and `requestedById` are ignored.  
If `file` is present, calls `verificationService.compare`. Otherwise `compareStored`.  
HTTP always uses `source: "INTERNAL"` and `requestedById` from the session.

```json
{
  "data": {
    "verification": {
      "id": "uuid",
      "status": "MATCH",
      "source": "INTERNAL",
      "evidenceId": "uuid",
      "evidenceVersionId": "uuid",
      "sha256": "hex64",
      "createdAt": "2026-09-24T00:00:00.000Z"
    }
  },
  "meta": {}
}
```

`status` ∈ MATCH | MISMATCH | PENDING | UNAVAILABLE  

- MATCH: presented or stored bytes hash to `EvidenceVersion.sha256`. Not “the claim is true”.  
- MISMATCH: hashes differ. Not REJECTED / FAILED / unsafe.  
- PENDING: authoritative hash is not ready.  
- UNAVAILABLE: authoritative record or stored bytes cannot be read.

MATCH does not change `Evidence.status` to `VERIFIED` and does not create an attestation or blockchain proof.  
This is not `POST /api/v1/attestations` and not `POST /api/v1/public/verify`.

---

## Attestations (current Stage 5 HTTP)

Envelope: `{ "data": { "attestation": {} }, "meta": {} }`  
Not `{ "attestation": {} }` and not the Stage 2 resource-keyed collections.

This is not `POST /api/v1/verification` and not `POST /api/v1/public/verify`.

### POST `/api/v1/attestations`

Auth: JWT  
Role gate: CONSULTANT_ENGINEER, CLIENT, PROCUREMENT_OFFICER, AUDITOR, ADMIN  
**Must call `assertCanAttest`.** CONTRACTOR → 403 for own evidence and for another contractor’s evidence.  
Project access is still required (`assertCanReadProject`). Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CLIENT / CONSULTANT_ENGINEER have no membership model yet → 403 after the role gate.

Verifier identity is the authenticated user. Client-supplied `verifierId` and `verifierRole` are ignored.  
`SITE_INSPECTOR` / `CLIENT_REPRESENTATIVE` are `VerificationPolicy.verifierLabels`, not JWT roles.

If the milestone has a policy, `allowedRoles` is used. Otherwise the default attestor roles apply.  
`requiredApprovals` is not evaluated in this slice. A MATCH verification is not required; the domain requires an existing evidence fingerprint (`sha256`).

Body: `{ "evidenceId", "milestoneId", "decision": "APPROVED" | "REJECTED", "comment?" }`

```json
{
  "data": {
    "attestation": {
      "id": "uuid",
      "evidenceId": "uuid",
      "milestoneId": "uuid",
      "decision": "APPROVED",
      "verifierRole": "AUDITOR",
      "comment": "optional",
      "createdAt": "2026-09-24T00:00:00.000Z"
    }
  },
  "meta": {}
}
```

`decision` is preserved exactly. HTTP does not rewrite `Evidence.status`.  
Unique `(evidenceId, verifierId)` → 409 `CONFLICT`.

400: missing/invalid UUID, invalid decision, evidence/milestone mismatch, missing fingerprint  
401: missing or invalid JWT  
403 codes: `CONTRACTOR_ATTEST_FORBIDDEN` (also blocked by the role gate), `UPLOADER_ATTEST_FORBIDDEN`, `OWNER_ATTEST_FORBIDDEN`, `ROLE_NOT_ALLOWED`, or `FORBIDDEN` when project access is denied  
404: missing evidence or milestone where absence may be revealed  
409: this verifier has already attested this evidence

Responses never include `passwordHash`, `storageKey`, storage paths, or invented scores.

### GET `/api/v1/attestations`

Not implemented (501). Filter-by-evidence/milestone listing is later.

---

## Passports (target, derived)

### GET `/api/v1/passports`

### GET `/api/v1/passports/:projectId`

Auth: JWT for full workspace view; Agent 7 may add a public subset later  
`data.passport` is computed: project identity, milestones, current evidence hashes, attestation decisions, proof tx hashes, synthetic nest/crb flags.  
Not a trust score. No Passport table.

---

## Public verification (implemented HTTP)

Agent 7 still owns Passport presentation. This POST is the unauthenticated compare adapter.

### GET `/api/v1/public/verify`

Grandfathered scaffold JSON explaining MATCH.

### POST `/api/v1/public/verify`

Auth: none  
multipart: `file` + `evidenceVersionId` or `evidenceId`  
Calls `verificationService.comparePublic`. No hash-only lookup.

```json
{
  "data": {
    "verification": {
      "status": "MATCH",
      "evidenceVersionId": "uuid",
      "meaning": "The submitted file matches the recorded evidence fingerprint. This does not mean the blockchain independently proves the underlying claim is true."
    }
  },
  "meta": {}
}
```

Never returned: storage keys/paths, emails, requester identity, private comments, authorization data, secrets, stack traces.  
Do not add `GET /public/evidence/:id` or `GET /public/hash/:hash`.

---

## Disputes (Task 4 lifecycle)

Responses use `{ "data": ..., "meta": {} }`; failures use the standard `{ "error": { "code", "message", "requestId" } }` envelope.

Disputes refer to a milestone and may refer to existing evidence and an original blockchain event. Creating one never changes Evidence, EvidenceVersion, or Verification. A separate `DisputeResolution` stores the terminal result, actor, and timestamp; the dispute status is the current lifecycle projection.

`status` ∈ OPEN | UNDER_REVIEW | RESOLVED | REJECTED. Create always stores `OPEN`; client-supplied status and actor identity are ignored. Resolver roles are ADMIN, AUDITOR, and PROCUREMENT_OFFICER. Valid terminal outcomes are RESOLVED and REJECTED.

### POST `/api/v1/disputes`

Auth: JWT  
Create roles: CONTRACTOR (own milestone/project), ADMIN. Other roles are denied by the existing permission/access rules.

Body: `{ "milestoneId", "reason", "evidenceId?", "originalEventId?" }`
Identity (`raisedById`) comes from the JWT. Client-supplied actor/status are ignored. Evidence must belong to the milestone; original event must belong to the project.

201: `{ "data": { "dispute": { "id", "milestoneId", "evidenceId", "raisedById", "status": "OPEN", "reason", "blockchainProof", "originalProof", "resolutions", "createdAt", "updatedAt" } }, "meta": {} }`

400: missing/invalid `milestoneId`, missing `reason`  
401: missing or invalid JWT  
403: wrong role or CONTRACTOR using another contractor’s milestone  
404: ADMIN + unknown milestone

Distinct challenges are allowed; there is no uniqueness constraint. Invalid UUIDs/missing fields return 400; inaccessible projects return 403; missing authorized references return 404.

### GET `/api/v1/disputes`

Auth: JWT  
Query: optional `milestoneId` and/or `projectId`  
Authz: existing project access rules and SQL filtering.

| Role | Visible disputes |
| --- | --- |
| ADMIN, AUDITOR, PROCUREMENT_OFFICER | All (optionally filtered) |
| CONTRACTOR | Own projects only |
| CLIENT, CONSULTANT_ENGINEER | None until Agent 6 defines membership (`[]`) |

200: `{ "data": { "disputes": [ ... ] }, "meta": {} }`  
Empty accessible set: `{ "data": { "disputes": [] }, "meta": {} }`

### GET `/api/v1/disputes/:disputeId`

Returns the dispute after project-read authorization. Missing dispute returns 404; inaccessible project returns 403.

### POST `/api/v1/disputes/:disputeId/review`

Resolver roles only. OPEN transitions to UNDER_REVIEW. Repeating UNDER_REVIEW is idempotent; terminal disputes return 409.

### POST `/api/v1/disputes/:disputeId/resolutions`

Resolver roles only. Body: `{ "status": "RESOLVED" | "REJECTED", "resolution": "..." }`. Creates one immutable resolution record and updates the current status. A matching retry returns the existing resolution; a conflicting retry returns 409.

Blockchain anchoring is optional and only attempted when an existing source event is confirmed. Pending rows are represented as PENDING without transaction hash/block number. No source event means no dispute/resolution proof. The contract was not changed.

## Corrections (current Stage 7 HTTP)

Envelope: `{ "data": { "correction" | "corrections": ... }, "meta": {} }`  
Not a Stage 2 resource-keyed collection.

Authz: project write/read via existing access helpers. CONTRACTOR cannot create or list another contractor’s corrections.  
CONTRACTOR cannot “resolve as verified” — there is no apply/resolve route in this slice.

The Prisma `Correction` model is authoritative: `milestoneId`, `originalEventId`, `reason`, optional `evidenceId`, `actorId`.  
There is no correction status/decision enum.

`originalEventId` is a required FK to an existing `BlockchainEvent` on the same project. This slice does **not** call BlockchainService or insert blockchain events.  
Optional `evidenceId` links existing evidence on the same milestone. This slice does **not** create or overwrite EvidenceVersion rows.

### POST `/api/v1/corrections`

Auth: JWT  
Create roles: CONTRACTOR (own milestone/project), ADMIN.  
CLIENT / CONSULTANT_ENGINEER pass the role gate but have no membership yet → 403.  
AUDITOR / PROCUREMENT_OFFICER → 403.

Body: `{ "milestoneId", "originalEventId", "reason", "evidenceId?" }`  
Identity (`actorId`) comes from the JWT. Client-supplied actor/status/decision/role ids are ignored.

201: `{ "data": { "correction": { "id", "milestoneId", "originalEventId", "evidenceId", "actorId", "reason", "createdAt" } }, "meta": {} }`

400: missing/invalid UUIDs, missing `reason`, event/evidence not on the milestone project  
401: missing or invalid JWT  
403: wrong role or CONTRACTOR using another contractor’s milestone  
404: ADMIN + unknown milestone; missing original event or evidence after write access

No unique constraint; duplicates are not mapped to 409.

### GET `/api/v1/corrections`

Auth: JWT  
Query: optional `milestoneId` and/or `projectId`  
Authz: project access, enforced in the SQL `where` clause

| Role | Visible corrections |
| --- | --- |
| ADMIN, AUDITOR, PROCUREMENT_OFFICER | All (optionally filtered) |
| CONTRACTOR | Own projects only |
| CLIENT, CONSULTANT_ENGINEER | None until Agent 6 defines membership (`[]`) |

200: `{ "data": { "corrections": [ ... ] }, "meta": {} }`  
Empty accessible set: `{ "data": { "corrections": [] }, "meta": {} }`

There is no `GET /api/v1/corrections/:id` and no apply/reject endpoint.

## Variations (target)

Keep existing path prefixes. POST creates a **new** linked record and optional new EvidenceVersion. Never overwrite historical hashes. Authz: project members / ADMIN; CONTRACTOR cannot “resolve as verified” via these routes.

---

## Audit (target)

### GET `/api/v1/audit`

Auth: JWT  
Roles: AUDITOR, ADMIN, PROCUREMENT_OFFICER  
Returns `AuditLog` rows. Do not expose password hashes in `metadata`.

---

## Integrations (current)

`GET /api/v1/integrations/crb/:registrationNumber`  
`GET /api/v1/integrations/nest/:reference`  
Auth: JWT  
Always synthetic: `source: "SYNTHETIC_DEMO"` plus notice.

---

## Error codes (initial set)

`UNAUTHENTICATED` `FORBIDDEN` `VALIDATION_ERROR` `NOT_FOUND` `CONFLICT` `NOT_IMPLEMENTED` `CONTRACTOR_ATTEST_FORBIDDEN` `UPLOADER_ATTEST_FORBIDDEN` `OWNER_ATTEST_FORBIDDEN` `ROLE_NOT_ALLOWED` `VERIFICATION_UNAVAILABLE`

Frontend: 401 clear session; 403 `/forbidden`; 501 unavailable; do not fabricate records.
