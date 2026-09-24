# Frontend API requirements

Stage 1 (auth + shell) remains described here. **New domain contracts and envelopes are in [docs/api/contracts.md](api/contracts.md).** Agent 0 baseline: [docs/architecture/](architecture/README.md).

This document lists APIs used or required by the frontend. It distinguishes implemented HTTP contracts from missing ones.

The frontend uses one client: `frontend/src/services/api/client.ts`.

Base URL: `{VITE_API_ORIGIN}/api/v1`

Header for authenticated requests: `Authorization: Bearer <token>`

The token is stored in the browser session store. It is never rendered.

## Error convention

Failure bodies observed in the backend:

Grandfathered auth/role errors:

```json
{ "error": "human-readable message" }
```

Evidence domain errors:

```json
{ "error": { "code": "FILE_TOO_LARGE", "message": "file exceeds the 26214400 byte limit", "requestId": "" } }
```

501 (scaffold stubs) also include `resource`:

```json
{ "error": "Not implemented in scaffold phase", "resource": "attestations" }
```

| HTTP status | Frontend handling |
| --- | --- |
| 400 | Show the server message. |
| 401 | Clear session. Treat as `UNAUTHORIZED` or `SESSION_EXPIRED`. Redirect to `/unauthorized` when the session is invalid. |
| 403 | Treat as `FORBIDDEN`. Show a permission message or `/forbidden`. |
| 404 | Record not found. |
| 409 | Conflict message. |
| 422 | Unprocessable request message. |
| 429 | Rate-limit message. |
| 500 | Generic load error with retry. |
| 501 | Unavailable module. No records are invented. |
| 503 | Service temporarily unavailable. |
| Network / timeout | “We couldn't reach the server.” |

---

## IMPLEMENTED

These endpoints have a working backend handler and a confirmed response shape.

### POST `/api/v1/auth/login`

- METHOD: POST
- AUTHENTICATION: None
- ROLES: None
- REQUEST:

```json
{ "email": "user@example.com", "password": "password123" }
```

- RESPONSE:

```json
{
  "token": "jwt",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "fullName": "Example User",
    "role": "CONTRACTOR"
  }
}
```

- ERRORS: 401 invalid credentials; 400 invalid body
- NOTES: Used by the login page.

### GET `/api/v1/auth/me`

- METHOD: GET
- AUTHENTICATION: JWT required
- ROLES: Any authenticated role
- REQUEST: none
- RESPONSE: `{ "user": { "id", "email", "fullName", "role" } }`
- ERRORS: 401 missing/invalid/expired token
- NOTES: Session restore.

### POST `/api/v1/auth/register`

- METHOD: POST
- AUTHENTICATION: None
- ROLES: Public registration excludes `ADMIN`
- REQUEST: `{ "email", "password", "fullName", "role" }`
- RESPONSE: same `{ token, user }` shape as login
- ERRORS: 400 invalid role or body; 409 email already registered
- NOTES: Used by the login page register mode.

### GET `/health`

- METHOD: GET
- AUTHENTICATION: None
- ROLES: None
- REQUEST: none
- RESPONSE: `{ "status": "ok", "service": "contractorproof-api" }`
- ERRORS: connection failure
- NOTES: Dashboard connectivity only. Not a trust score.

### GET `/api/v1/integrations/crb/:registrationNumber`

- METHOD: GET
- AUTHENTICATION: JWT required
- ROLES: Any authenticated role (no extra role check on this route)
- REQUEST: path parameter `registrationNumber`
- RESPONSE:

```json
{
  "notice": "Synthetic/demo CRB data. No live CRB API was called.",
  "source": "SYNTHETIC_DEMO",
  "found": true,
  "crbRegistrationNumber": "CRB-DEMO-001",
  "crbCategory": "Works",
  "crbType": "Building",
  "crbClass": "Class I",
  "crbStatus": "ACTIVE",
  "crbLastVerifiedAt": "2026-01-15T00:00:00.000Z"
}
```

When no synthetic record matches, `found` is `false` and category/type/class/status/lastVerified are `null`.

- ERRORS: 400 if the path parameter is missing; 401 if unauthenticated
- NOTES: Mock adapter only. The frontend lookup form uses this exact contract. It is not a contractor list.

### GET `/api/v1/integrations/nest/:reference`

- METHOD: GET
- AUTHENTICATION: JWT required
- ROLES: Any authenticated role (no extra role check on this route)
- REQUEST: path parameter `reference`
- RESPONSE:

```json
{
  "notice": "Synthetic/demo NeST data. No live NeST API was called.",
  "source": "SYNTHETIC_DEMO",
  "found": true,
  "nestTenderReference": "NEST-DEMO-100",
  "nestContractReference": "CNT-DEMO-100",
  "ocid": "ocds-demo-100",
  "procuringEntity": "Demo Procuring Entity",
  "contractStatus": "ACTIVE",
  "contractStartDate": "2026-02-01",
  "contractEndDate": "2027-01-31"
}
```

When no synthetic record matches, `found` is `false` and the remaining fields except `nestTenderReference` are `null`.

- ERRORS: 400 if the path parameter is missing; 401 if unauthenticated
- NOTES: Mock adapter only. The frontend lookup form uses this exact contract. It is not a project list.

### GET `/api/v1/contractors`

- METHOD: GET
- PATH: `/api/v1/contractors`
- AUTH: Bearer JWT required. Any authenticated role. No extra role filter.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE:

```json
{
  "contractors": [
    {
      "id": "uuid",
      "userId": "uuid",
      "legalName": "Example Contractor",
      "crbRegistrationNumber": null,
      "crbCategory": null,
      "crbType": null,
      "crbClass": null,
      "crbStatus": null,
      "crbLastVerifiedAt": null,
      "crbSource": "SYNTHETIC_DEMO",
      "createdAt": "2026-09-24T07:49:43.000Z",
      "updatedAt": "2026-09-24T07:49:43.000Z",
      "user": {
        "id": "uuid",
        "email": "user@example.com",
        "fullName": "Example Contractor",
        "role": "CONTRACTOR"
      }
    }
  ]
}
```

- EMPTY RESPONSE: `{ "contractors": [] }`
- 400: not implemented on this collection route
- 401: `{ "error": "missing bearer token" }` or `{ "error": "invalid or expired token" }`
- 403: not implemented
- 404: not implemented
- 500: `{ "error": "…" }` for unexpected failures
- NOTES: Nested `user` is `PublicUser`. `passwordHash` is never selected. Dates are ISO-8601 strings. Create/edit is not offered.

### GET `/api/v1/contractors/:contractorId`

- METHOD: GET
- PATH: `/api/v1/contractors/:contractorId`
- AUTH: Bearer JWT required. Any authenticated role. No extra role filter.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE: `{ "contractor": { ...same object as list item... } }`
- EMPTY RESPONSE: not applicable; missing records are 404
- 400: `{ "error": "contractorId must be a valid UUID" }`
- 401: same as contractors list
- 403: not implemented
- 404: `{ "error": "contractor not found" }`
- 500: `{ "error": "…" }` for unexpected failures

### GET `/api/v1/projects`

- METHOD: GET
- PATH: `/api/v1/projects`
- AUTH: Bearer JWT required. Any authenticated role. No extra role filter.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE:

```json
{
  "projects": [
    {
      "id": "uuid",
      "contractorId": "uuid",
      "name": "List Project",
      "description": "List Project description",
      "nestTenderReference": "NEST-DEMO-100",
      "nestContractReference": "CNT-DEMO-100",
      "ocid": "ocds-demo-100",
      "procuringEntity": "Demo Procuring Entity",
      "contractStatus": "ACTIVE",
      "contractStartDate": "2026-02-01T00:00:00.000Z",
      "contractEndDate": "2027-01-31T00:00:00.000Z",
      "nestSource": "SYNTHETIC_DEMO",
      "createdAt": "2026-09-24T07:49:43.000Z",
      "updatedAt": "2026-09-24T07:49:43.000Z"
    }
  ]
}
```

- EMPTY RESPONSE: `{ "projects": [] }`
- 400: not implemented on this collection route
- 401: same as contractors
- 403: not implemented
- 404: not implemented
- 500: `{ "error": "…" }` for unexpected failures
- NOTES: Fields are Prisma `Project` columns only. No nested contractor/user. No invented scores. No create/edit API.

### GET `/api/v1/projects/:projectId`

- METHOD: GET
- PATH: `/api/v1/projects/:projectId`
- AUTH: Bearer JWT required. Any authenticated role. No extra role filter.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE: `{ "project": { ...same object as list item... } }`
- EMPTY RESPONSE: not applicable; missing records are 404
- 400: `{ "error": "projectId must be a valid UUID" }`
- 401: same as contractors
- 403: not implemented
- 404: `{ "error": "project not found" }`
- 500: `{ "error": "…" }` for unexpected failures

### GET `/api/v1/projects/:projectId/milestones`

- METHOD: GET
- PATH: `/api/v1/projects/:projectId/milestones`
- AUTH: Bearer JWT required. Any authenticated role. No extra role filter.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE:

```json
{
  "milestones": [
    {
      "id": "uuid",
      "projectId": "uuid",
      "policyId": null,
      "name": "Foundation",
      "description": "Foundation description",
      "status": "PENDING",
      "createdAt": "2026-09-24T07:49:43.000Z",
      "updatedAt": "2026-09-24T07:49:43.000Z"
    }
  ]
}
```

- EMPTY RESPONSE (project exists, no milestones): `{ "milestones": [] }`
- 400: `{ "error": "projectId must be a valid UUID" }`
- 401: same as contractors
- 403: not implemented
- 404: `{ "error": "project not found" }` when the project does not exist
- 500: `{ "error": "…" }` for unexpected failures
- NOTES: This is the only milestone collection route. There is no `GET /api/v1/milestones`. Status is Prisma `MilestoneStatus` unchanged: `PENDING`, `IN_PROGRESS`, `PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`. No milestone create/edit API.

### GET `/api/v1/evidence`

- METHOD: GET
- PATH: `/api/v1/evidence`
- AUTH: Bearer JWT required
- ROLES: Route allows ADMIN, AUDITOR, PROCUREMENT_OFFICER, CONTRACTOR, CONSULTANT_ENGINEER, CLIENT. Visible rows are scoped in the query: privileged roles see all; CONTRACTOR sees own projects; CLIENT and CONSULTANT_ENGINEER receive `[]`.
- REQUEST: optional query `milestoneId` and/or `projectId` (UUIDs)
- SUCCESS STATUS: 200
- SUCCESS RESPONSE:

```json
{
  "data": {
    "evidence": [
      {
        "id": "uuid",
        "milestoneId": "uuid",
        "currentVersionId": "uuid",
        "fileName": "site.jpg",
        "sha256": "64-char hex",
        "mimeType": "image/jpeg",
        "sizeBytes": 12,
        "status": "PENDING_VERIFICATION",
        "verificationStatus": "PENDING",
        "currentVersion": {
          "id": "uuid",
          "evidenceId": "uuid",
          "versionNumber": 1,
          "sha256": "64-char hex",
          "fileName": "site.jpg",
          "mimeType": "image/jpeg",
          "sizeBytes": 12,
          "createdAt": "2026-09-24T07:49:43.000Z"
        },
        "createdAt": "2026-09-24T07:49:43.000Z",
        "updatedAt": "2026-09-24T07:49:43.000Z"
      }
    ]
  },
  "meta": {}
}
```

- EMPTY RESPONSE: `{ "data": { "evidence": [] }, "meta": {} }`
- 400: invalid `milestoneId` or `projectId` UUID — `{ "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "" } }`
- 401: `{ "error": "missing bearer token" }` or `{ "error": "invalid or expired token" }`
- 403: `{ "error": "insufficient role" }` when the JWT role is not on the route
- 404: not used for an empty accessible set
- 500: `{ "error": { "code": "INTERNAL_ERROR", "message": "…", "requestId": "" } }`
- NOTES: There is no `GET /api/v1/evidence/:id`, version list, or download API. Responses never include `storageKey`, `storageReference`, filesystem paths, or `passwordHash`. `status` is workflow only: `PENDING_VERIFICATION` | `VERIFIED` | `REJECTED`. `verificationStatus` on create/list is `PENDING`. MATCH / MISMATCH are verification outcomes, not evidence workflow statuses. The frontend displays `currentVersion` when present and does not invent earlier versions.

### POST `/api/v1/evidence`

- METHOD: POST
- PATH: `/api/v1/evidence`
- AUTH: Bearer JWT required
- ROLES: CONTRACTOR (own project milestone only), ADMIN
- REQUEST: `multipart/form-data` fields `milestoneId` (UUID) and `file` (binary)
- UPLOAD CONSTRAINTS: max 26,214,400 bytes (`EVIDENCE_MAX_FILE_BYTES`, 25 MiB). Allowed extensions/MIME: `.pdf`/`application/pdf`, `.jpg`/`.jpeg`/`image/jpeg`, `.png`/`image/png`, `.webp`/`image/webp`, `.tif`/`.tiff`/`image/tiff`, `.gif`/`image/gif`, `.docx`/`application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `.xlsx`/`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `.csv`/`text/csv`, `.txt`/`text/plain`.
- SUCCESS STATUS: 201
- SUCCESS RESPONSE: `{ "data": { "evidence": { ...same object as list item... } }, "meta": {} }`
- EMPTY RESPONSE: not applicable
- 400: missing file, empty file, missing/invalid `milestoneId`, oversized file (`FILE_TOO_LARGE`), disallowed type (`FILE_TYPE_NOT_ALLOWED`)
- 401: same as evidence list
- 403: wrong role, or CONTRACTOR uploading to another contractor's milestone (`FORBIDDEN`)
- 404: ADMIN + unknown milestone (`MILESTONE_NOT_FOUND`)
- 409: duplicate SHA-256 on the same evidence (`HASH_CONFLICT`)
- 503: storage failure (`STORAGE_FAILED`)
- NOTES: Client-supplied `sha256`, `storageKey`, `uploadedById`, and `versionNumber` are ignored. A successful upload creates version 1 with `status: "PENDING_VERIFICATION"` and `verificationStatus: "PENDING"`. Upload is not verification and is not blockchain confirmation.

### POST `/api/v1/verification`

- METHOD: POST
- PATH: `/api/v1/verification` (singular). `/api/v1/verifications` is retired.
- AUTH: Bearer JWT required
- ROLES (VERIFY_INTERNAL): ADMIN, AUDITOR, PROCUREMENT_OFFICER, CONSULTANT_ENGINEER, CLIENT
- CONTRACTOR: always 403, including self-verification and another contractor's evidence
- PROJECT ACCESS: still required after the role gate. Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER. CLIENT / CONSULTANT_ENGINEER have no membership model yet → 403
- REQUEST: JSON or `multipart/form-data` with `evidenceId` and/or `evidenceVersionId` (UUID). Optional `file`. Client-supplied `source` and `requestedById` are ignored. HTTP always uses `source: "INTERNAL"` and `requestedById` from the session.
- SUCCESS STATUS: 200
- SUCCESS RESPONSE:

```json
{
  "data": {
    "verification": {
      "id": "uuid-or-null",
      "status": "MATCH",
      "source": "INTERNAL",
      "evidenceId": "uuid-or-null",
      "evidenceVersionId": "uuid-or-null",
      "sha256": "hex64-or-null",
      "createdAt": "2026-09-24T00:00:00.000Z"
    }
  },
  "meta": {}
}
```

- `status` ∈ `MATCH` | `MISMATCH` | `PENDING` | `UNAVAILABLE` (exact; never rewritten)
  - MATCH: presented or stored bytes hash to `EvidenceVersion.sha256`. Not “the claim is true”.
  - MISMATCH: hashes differ. Integrity mismatch only — not REJECTED, FAILED, fraud, or unsafe.
  - PENDING: authoritative hash is not ready. `id` / `sha256` / `createdAt` may be null.
  - UNAVAILABLE: authoritative record or stored bytes cannot be read.
- MEANING MAPPING: HTTP `toHttpVerification` omits the service `meaning` field. The frontend maps status → backend VerificationService meaning at the domain boundary only. Status values are not changed.
- BLOCKCHAIN: this response has no transaction, network, or anchor fields. Anchoring is not performed by this endpoint (not synchronous, not asynchronous). The frontend shows “Blockchain proof unavailable”.
- GET `/api/v1/verification` and GET `/api/v1/verification/:id` do not exist. The UI review queue uses GET `/api/v1/evidence`.
- MATCH does not change `Evidence.status` to `VERIFIED` and does not create an attestation.
- 400: missing/invalid `evidenceId` or `evidenceVersionId`
- 401: missing or invalid JWT
- 403: CONTRACTOR, insufficient role, or no project access (`FORBIDDEN` / `insufficient permission` / `insufficient role`)
- 404: missing evidence or version (`EVIDENCE_NOT_FOUND`, `VERSION_NOT_FOUND`)
- 409: not a documented success-path code for this compare
- 422: not a documented success-path code for this compare
- 500: unexpected failure
- 503: not a documented success-path code for this compare
- NOTES: There is no list or detail read API. The frontend does not invent GET routes.

### POST `/api/v1/attestations`

- METHOD: POST
- PATH: `/api/v1/attestations`
- AUTH: Bearer JWT required
- ROLES (ATTEST): CONSULTANT_ENGINEER, CLIENT, PROCUREMENT_OFFICER, AUDITOR, ADMIN
- CONTRACTOR: always 403 (role gate, plus `CONTRACTOR_ATTEST_FORBIDDEN` if reached)
- ADDITIONAL 403 CODES: `UPLOADER_ATTEST_FORBIDDEN`, `OWNER_ATTEST_FORBIDDEN`, `ROLE_NOT_ALLOWED`, or `FORBIDDEN` when project access is denied
- PROJECT ACCESS: `assertCanReadProject` after the role gate. CLIENT / CONSULTANT_ENGINEER have no membership model yet → 403
- REQUEST:

```json
{
  "evidenceId": "uuid",
  "milestoneId": "uuid",
  "decision": "APPROVED",
  "comment": "optional"
}
```

`decision` ∈ `APPROVED` | `REJECTED`. Client-supplied `verifierId`, `verifierRole`, and `evidenceVersionId` are ignored. A MATCH verification is not required; an evidence fingerprint (`sha256`) is required.

- SUCCESS STATUS: 201
- SUCCESS RESPONSE:

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

- `decision` is preserved exactly. HTTP does not rewrite `Evidence.status`. Unique `(evidenceId, verifierId)` → 409 `CONFLICT`.
- BLOCKCHAIN: this response has no transaction, network, or anchor fields.
- GET `/api/v1/attestations` is 501 (`resource: "attestations"`). The frontend does not invent a list or detail view.
- 400: missing/invalid UUID, invalid decision, evidence/milestone mismatch, missing fingerprint
- 401: missing or invalid JWT
- 403: codes above
- 404: missing evidence or milestone
- 409: this verifier has already attested this evidence
- NOTES: Attestation is not fingerprint comparison. APPROVED is not MATCH. REJECTED is not MISMATCH.

---

### GET `/api/v1/passports`

- METHOD: GET
- PATH: `/api/v1/passports`
- AUTH: Bearer JWT required. No extra role filter on the route.
- IMPLEMENTED: **No.** `notImplemented("passports")`.
- SUCCESS RESPONSE: none. The frontend does not parse a success envelope.
- OBSERVED RESPONSE: `501`

```json
{ "error": "Not implemented in scaffold phase", "resource": "passports" }
```

- NOTES: Architecture (ADR-0007) describes a derived projection, not a Passport table. Agent 7 has not shipped the handler. The frontend does not invent `data.passport`, scores, or blockchain proof from this stub.

### GET `/api/v1/passports/:projectId`

- METHOD: GET
- PATH: `/api/v1/passports/:projectId`
- AUTH: Bearer JWT required
- IMPLEMENTED: **No.** Same 501 stub as the collection route.
- NOTES: The frontend `/passports/:contractorId` route is **not** this API. It composes implemented GET resources (below).

### Passport page composition (implemented GETs, not a Passport API)

The authenticated `/passports` and `/passports/:contractorId` screens assemble history from:

| METHOD | PATH | USED FOR |
| --- | --- | --- |
| GET | `/api/v1/contractors` | Passport index |
| GET | `/api/v1/contractors/:contractorId` | Contractor identity |
| GET | `/api/v1/projects` | Projects filtered client-side by `contractorId` |
| GET | `/api/v1/projects/:projectId/milestones` | Milestone history |
| GET | `/api/v1/evidence?projectId=` | Evidence filename, SHA-256, version, `status`, `verificationStatus` |

There is no `GET /projects?contractorId=`. Ownership is the `contractorId` field already returned on each project.

Not called by the passport UI:

- POST `/verification` (write, not a history list)
- POST `/attestations` (write; GET list is 501)
- GET `/blockchain` (501, ADMIN/AUDITOR only)
- GET/POST `/public/verify` (later public-verification stage)

---

## Other scaffold routes not consumed in this stage

These exist as 501 stubs or later-stage public APIs. Success RESPONSE: **BACKEND CONTRACT REQUIRED**

| METHOD | PATH | AUTHENTICATION | NOTES |
| --- | --- | --- | --- |
| GET | `/api/v1/attestations` | JWT | 501 stub. POST is implemented above. Passport shows Unavailable. |
| GET, POST | `/api/v1/disputes` | JWT | Later stage |
| GET, POST | `/api/v1/corrections` | JWT | Later stage |
| GET, POST | `/api/v1/variations` | JWT | Later stage |
| GET | `/api/v1/blockchain` | JWT | 501. Restricted to ADMIN, AUDITOR. Passport shows Unavailable. |
| GET | `/api/v1/public/verify` | None | Public verification is a later stage |
| POST | `/api/v1/public/verify` | None | Public verification is a later stage |

There is no `/api/v1/audit` route.

## Roles the frontend may receive

`CONTRACTOR` | `CLIENT` | `CONSULTANT_ENGINEER` | `PROCUREMENT_OFFICER` | `AUDITOR` | `ADMIN`

Hiding a navigation item is not authorization. The backend remains authoritative for 401 and 403.
