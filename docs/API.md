# API

**Canonical contracts: [docs/api/api-overview.md](api/api-overview.md) and [docs/api/contracts.md](api/contracts.md).**

Base path: `/api/v1`. Frontend origin env: `VITE_API_ORIGIN`.

## Implemented now

| Method | Path | Auth | Status |
| --- | --- | --- | --- |
| GET | `/health` | No | Working |
| GET | `/api/v1/health` | No | Working |
| POST | `/api/v1/auth/register` | No | Working; Agent 6 will limit roles to CONTRACTOR, CLIENT |
| POST | `/api/v1/auth/login` | No | Working |
| GET | `/api/v1/auth/me` | JWT | Working |
| GET | `/api/v1/integrations/crb/:registrationNumber` | JWT | Synthetic |
| GET | `/api/v1/integrations/nest/:reference` | JWT | Synthetic |
| GET | `/api/v1/contractors` | JWT | Working |
| GET | `/api/v1/contractors/:contractorId` | JWT | Working |
| GET | `/api/v1/projects` | JWT | Working |
| GET | `/api/v1/projects/:projectId` | JWT | Working |
| GET | `/api/v1/projects/:projectId/milestones` | JWT | Working |
| POST | `/api/v1/evidence` | JWT | Working |
| GET | `/api/v1/evidence` | JWT | Working |
| POST | `/api/v1/verification` | JWT | Working |
| POST | `/api/v1/attestations` | JWT | Working |
| POST | `/api/v1/disputes` | JWT | Working |
| GET | `/api/v1/disputes` | JWT | Working |
| POST | `/api/v1/corrections` | JWT | Working |
| GET | `/api/v1/corrections` | JWT | Working |
| GET | `/api/v1/public/verify` | No | Scaffold explanation |

## Contractors

Authenticated reads only. No extra role filter. Nested `user` is the existing `PublicUser` shape. `passwordHash` is never selected or returned.

### GET `/api/v1/contractors`

200:

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

Empty 200: `{ "contractors": [] }`  
401 missing token: `{ "error": "missing bearer token" }`  
401 invalid token: `{ "error": "invalid or expired token" }`

### GET `/api/v1/contractors/:contractorId`

200: `{ "contractor": { ...same object as list item... } }`  
400: `{ "error": "contractorId must be a valid UUID" }`  
401: same as list  
404: `{ "error": "contractor not found" }`

## Projects

Authenticated reads only. No extra role filter. Fields are the Prisma `Project` columns. No nested contractor/user object. No invented scores.

### GET `/api/v1/projects`

200:

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

Empty 200: `{ "projects": [] }`  
401: same as contractors

### GET `/api/v1/projects/:projectId`

200: `{ "project": { ...same object as list item... } }`  
400: `{ "error": "projectId must be a valid UUID" }`  
401: same as list  
404: `{ "error": "project not found" }`

### GET `/api/v1/projects/:projectId/milestones`

Project must exist. Milestones are queried with `where: { projectId }`. Status is the Prisma `MilestoneStatus` value unchanged.

200:

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

Empty 200 (project exists, no milestones): `{ "milestones": [] }`  
400: `{ "error": "projectId must be a valid UUID" }`  
401: same as contractors  
404: `{ "error": "project not found" }`

There is no `GET /api/v1/milestones`.

## Evidence

Canonical envelope: `{ "data": { "evidence": ... }, "meta": {} }`.  
This is not the Stage 2 `{ contractors | projects | milestones }` shape.

`status` is workflow only: `PENDING_VERIFICATION` | `VERIFIED` | `REJECTED`.  
`verificationStatus` on create is `PENDING`. MATCH / MISMATCH are not Evidence statuses.

Responses never include `storageKey`, `storageReference`, filesystem paths, or `passwordHash`.

### POST `/api/v1/evidence`

Auth: JWT  
Roles: CONTRACTOR (own project only), ADMIN  
Content-Type: `multipart/form-data`  
Fields: `milestoneId` (UUID), `file` (binary)  
Limit: `EVIDENCE_MAX_FILE_BYTES`  
Behavior: authenticate → authorize → ownership → `evidenceService.create`

201: `{ "data": { "evidence": { "id", "milestoneId", "currentVersionId", "fileName", "sha256", "status": "PENDING_VERIFICATION", "verificationStatus": "PENDING", ... } }, "meta": {} }`

400: missing/invalid multipart, missing `milestoneId`, invalid UUID, empty file, oversized file, disallowed type  
401: `{ "error": "missing bearer token" }` / `{ "error": "invalid or expired token" }`  
403: non-ADMIN/non-CONTRACTOR, or CONTRACTOR uploading to another contractor's milestone  
404: ADMIN + unknown milestone

### GET `/api/v1/evidence`

Auth: JWT  
Authz: project access, applied in the database query.  
Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CONTRACTOR: own projects only.  
CLIENT / CONSULTANT_ENGINEER: empty list (no membership model yet).

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "evidence": [] }, "meta": {} }`.

There is no `GET /api/v1/evidence/:id` in this slice.

## Verification

Canonical route: `POST /api/v1/verification` (singular).  
`/api/v1/verifications` is retired and is not an active API.

Envelope: `{ "data": { "verification": { ... } }, "meta": {} }`

Auth: JWT  
Roles: ADMIN, AUDITOR, PROCUREMENT_OFFICER (project access).  
CONSULTANT_ENGINEER and CLIENT are accepted by the role gate but have no project membership yet, so they receive 403.  
**CONTRACTOR cannot verify**, including their own evidence and another contractor’s evidence.

Request (JSON or multipart): `evidenceId` and/or `evidenceVersionId`. Optional `file`.  
If `file` is present, `verificationService.compare` runs. Otherwise `compareStored`.  
`source` is always `INTERNAL`. `requestedById` is the authenticated user.

200:

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

`status` ∈ MATCH | MISMATCH | PENDING | UNAVAILABLE.  
This does not change `Evidence.status` (`PENDING_VERIFICATION` / `VERIFIED` / `REJECTED`).  
MATCH is fingerprint-only. It is not attestation and does not prove the construction claim.

400: missing or invalid `evidenceId` / `evidenceVersionId`  
401: missing or invalid JWT  
403: CONTRACTOR, or a role without project access  
Responses never include `storageKey`, storage paths, or `passwordHash`.

## Attestations

Canonical route: `POST /api/v1/attestations` (plural).  
Envelope: `{ "data": { "attestation": { ... } }, "meta": {} }`

This is not fingerprint verification and not public proof verification.

Auth: JWT  
Role gate: CONSULTANT_ENGINEER, CLIENT, PROCUREMENT_OFFICER, AUDITOR, ADMIN.  
Domain gate: `assertCanAttest` after `assertCanReadProject`.  
**CONTRACTOR cannot attest**, including their own evidence and another contractor’s evidence.  
Changing `evidenceId`, `evidenceVersionId`, `verifierId`, or `verifierRole` does not bypass that.

Verifier identity always comes from the JWT (`req.user.id` / `req.user.role`).  
Client-supplied `verifierId` and `verifierRole` are ignored.

If the milestone has a `VerificationPolicy`, `allowedRoles` is authoritative.  
Otherwise the default attestor set is used.  
`requiredApprovals` is stored on the policy and is **not** evaluated by this HTTP slice.  
A MATCH verification is **not** required; the domain requires an authoritative `sha256` on the evidence.

`SITE_INSPECTOR` and `CLIENT_REPRESENTATIVE` are verifier labels, not JWT roles.

CLIENT / CONSULTANT_ENGINEER pass the role gate but currently fail project access (no membership model yet) → 403.

Request:

```json
{
  "evidenceId": "uuid",
  "milestoneId": "uuid",
  "decision": "APPROVED",
  "comment": "optional"
}
```

`decision` ∈ APPROVED | REJECTED. These are attestation decisions, not `Evidence.status` values.

201:

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

This does not change `Evidence.status` from the controller.  
Unique `(evidenceId, verifierId)` → 409.

400: missing `evidenceId` / `milestoneId`, invalid UUID, invalid decision, evidence/milestone mismatch, missing fingerprint  
401: `{ "error": "missing bearer token" }` / `{ "error": "invalid or expired token" }`  
403: CONTRACTOR, unauthorized role, uploader self-attest, owner self-attest, policy `ROLE_NOT_ALLOWED`, or no project access  
404: missing evidence or milestone where absence may be revealed  
409: this verifier has already attested this evidence  

GET `/api/v1/attestations` remains 501.

Responses never include `passwordHash`, `storageKey`, storage paths, or invented scores.

## Disputes

Canonical routes: `POST /api/v1/disputes` and `GET /api/v1/disputes`.  
Envelope: `{ "data": { "dispute": { ... } }, "meta": {} }` on create.  
List: `{ "data": { "disputes": [ ... ] }, "meta": {} }`.

This is not a correction, variation, attestation, or blockchain event.

Auth: JWT  
Create roles: CONTRACTOR (own project), ADMIN.  
CLIENT / CONSULTANT_ENGINEER pass the create role gate but have no project membership yet → 403.  
AUDITOR / PROCUREMENT_OFFICER cannot create (403).

Read: project access, applied in the database query.  
Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CONTRACTOR: own projects only.  
CLIENT / CONSULTANT_ENGINEER: empty list (no membership model yet).

`raisedById` is always the authenticated user. Client-supplied `raisedById`, `actorId`, `userId`, `role`, `status`, `evidenceId`, and `originalEventId` are ignored.

There is no dispute-type enum. The Prisma target is `milestoneId`. Dispute has no `evidenceId` and this slice does not create an EvidenceVersion or BlockchainEvent.

`status` is created as `OPEN`. Clients cannot set `UNDER_REVIEW`, `RESOLVED`, or `REJECTED` on create. There is no resolution endpoint in this slice.

### POST `/api/v1/disputes`

Request:

```json
{
  "milestoneId": "uuid",
  "reason": "progress claim does not match site works"
}
```

201:

```json
{
  "data": {
    "dispute": {
      "id": "uuid",
      "milestoneId": "uuid",
      "raisedById": "uuid",
      "status": "OPEN",
      "reason": "progress claim does not match site works",
      "createdAt": "2026-09-24T00:00:00.000Z",
      "updatedAt": "2026-09-24T00:00:00.000Z"
    }
  },
  "meta": {}
}
```

400: missing `milestoneId` / `reason`, invalid UUID  
401: `{ "error": "missing bearer token" }` / `{ "error": "invalid or expired token" }`  
403: unauthorized role, or CONTRACTOR using another contractor’s `milestoneId`  
404: ADMIN + unknown milestone  

There is no unique constraint on `(milestoneId, raisedById)`. Duplicate creates are allowed.

### GET `/api/v1/disputes`

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "disputes": [] }, "meta": {} }`.

200: `{ "data": { "disputes": [ ... ] }, "meta": {} }`

Responses never include `passwordHash`, `storageKey`, storage paths, blockchain event internals, or invented scores.

There is no `GET /api/v1/disputes/:id` and no resolve/reject route in this slice.

## Corrections

Authenticated endpoints: `POST /api/v1/corrections`, `GET /api/v1/corrections`, `GET /api/v1/corrections/:correctionId`, `POST /api/v1/corrections/:correctionId/review`, and `POST /api/v1/corrections/:correctionId/resolve`.

All correction responses use `{ "data": ..., "meta": {} }`; domain errors use `{ "error": { "code", "message", "requestId" } }`. Authentication middleware retains the established 401 response.

Creation stores OPEN. A resolver transitions OPEN → UNDER_REVIEW → APPROVED/REJECTED. Review retries at UNDER_REVIEW are idempotent. The terminal result, note, resolver, timestamp, and optional corrected version are appended to one `CorrectionResolution` row; matching resolution retries return it, conflicting retries return 409. Distinct correction requests are allowed because the domain defines no uniqueness key.

Create roles: CONTRACTOR on own project and ADMIN. Read access follows project access: CONTRACTOR own projects; ADMIN, AUDITOR, and PROCUREMENT_OFFICER follow the privileged read rules. Resolver roles are ADMIN, AUDITOR, PROCUREMENT_OFFICER. Other roles have no project membership and are denied/receive an empty filtered list as applicable. Client-supplied actor/status fields are ignored.

`originalEventId` must belong to the milestone's project. When it is a VERIFICATION event, its reference must resolve to an EvidenceVersion on that milestone; its id/hash are kept as the correction's original version. Optional `evidenceId` identifies corrected/related evidence on the same milestone and may be the existing evidence with a later version or a separate newly uploaded Evidence record. An approved evidence correction must link a version from that evidence; if it uses the original Evidence record, the version must be later than the original. EvidenceVersion rows remain immutable; appending on the same Evidence advances only its current-version projection.

No evidence is copied into a correction-specific store. Evidence versions and verifications remain separately queryable. Correction blockchain proof is attempted only for APPROVED corrections with a corrected version and a confirmed original event. Pending transactions are explicitly unconfirmed; failed chain writes do not claim confirmation. Retrying the same resolution reuses its pending logical event and can confirm it after recovery. No blockchain event is created without those conditions.

### POST `/api/v1/corrections`

Request:

```json
{
  "milestoneId": "uuid",
  "originalEventId": "uuid",
  "reason": "as-built drawing supersedes issued set",
      "evidenceId": "optional-uuid"
}
```

201:

```json
{
  "data": {
    "correction": {
      "id": "uuid",
      "milestoneId": "uuid",
      "originalEventId": "uuid",
      "evidenceId": null,
      "actorId": "uuid",
      "status": "OPEN",
      "reason": "as-built drawing supersedes issued set",
      "originalEvidenceVersion": null,
      "correctedEvidence": null,
      "blockchainProof": null,
      "resolutions": [],
      "createdAt": "2026-09-24T00:00:00.000Z"
    }
  },
  "meta": {}
}
```

400: missing `milestoneId` / `originalEventId` / `reason`, invalid UUID, event/evidence not on the milestone project  
401: `{ "error": "missing bearer token" }` / `{ "error": "invalid or expired token" }`  
403: unauthorized role, or CONTRACTOR using another contractor’s `milestoneId`  
404: ADMIN + unknown milestone; missing original event or evidence after write access  

There is no unique constraint. Duplicate creates are allowed.

### GET `/api/v1/corrections`

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "corrections": [] }, "meta": {} }`.

200: `{ "data": { "corrections": [ ... ] }, "meta": {} }`

`GET /api/v1/corrections` accepts optional `milestoneId` and `projectId` filters. `GET /:correctionId` returns one record after project authorization. Review has an empty body. Resolve body: `{ "status": "APPROVED" | "REJECTED", "resolution": "...", "correctedEvidenceVersionId?": "uuid" }`.

Responses never include `passwordHash`, storage keys/paths, or private infrastructure secrets. Transaction hash and block number are exposed only as fields of an explicitly `CONFIRMED` or `PENDING` proof object.

## Stubs (501)

GET attestations, variations, passports, blockchain, POST public/verify.

Public POST verify will return MATCH or MISMATCH for fingerprint compare only. MATCH does not prove the construction claim.
