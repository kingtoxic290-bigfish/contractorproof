# API

**Canonical contracts: [docs/api/api-overview.md](api/api-overview.md) and [docs/api/contracts.md](api/contracts.md).**

Base path: `/api/v1`. Frontend origin env: `VITE_API_ORIGIN`.

## Implemented now

| Method | Path | Auth | Status |
| --- | --- | --- | --- |
| GET | `/health` | No | Working |
| GET | `/api/v1/health` | No | Working |
| POST | `/api/v1/auth/register` | No | Working; registration is limited to CONTRACTOR and CLIENT |
| POST | `/api/v1/auth/login` | No | Working |
| GET | `/api/v1/auth/me` | JWT | Working |
| POST | `/api/v1/users` | JWT (ADMIN) | Working; provisions a privileged account |
| GET | `/api/v1/integrations/nest/:reference` | JWT | Synthetic |
| GET | `/api/v1/contractors` | JWT | Working; optional `?crbRegistrationNumber=` discovery filter |
| GET | `/api/v1/contractors/:contractorId` | JWT | Working |
| GET | `/api/v1/contractors/me/passport` | JWT (CONTRACTOR) | Working |
| GET | `/api/v1/contractors/:contractorId/crb` | JWT | Working; append-only CRB check history |
| POST | `/api/v1/contractors/:contractorId/crb/verify` | JWT | Working; excludes CONTRACTOR |
| GET | `/api/v1/contractors/:contractorId/procurement` | JWT | Working; recorded procurement records |
| POST | `/api/v1/contractors/:contractorId/procurement/:recordId/link` | JWT (ADMIN, PROCUREMENT_OFFICER) | Working |
| POST | `/api/v1/procurement/sync` | JWT (ADMIN, PROCUREMENT_OFFICER) | Working; sandbox or NeST/OCDS source |
| GET | `/api/v1/contractors/:contractorId/passport` | JWT | Working |
| GET | `/api/v1/passports` | JWT | Working; project Passports in the caller's project access set |
| GET | `/api/v1/passports/:projectId` | JWT | Working; detailed Project Passport |
| GET | `/api/v1/projects` | JWT | Working |
| POST | `/api/v1/projects` | JWT (CLIENT, ADMIN) | Working; the caller becomes the project owner |
| PATCH | `/api/v1/projects/:projectId/contractor` | JWT (CLIENT, ADMIN) | Working; owner-scoped assignment |
| GET | `/api/v1/projects/:projectId/lifecycle-history` | JWT | Working; append-only lifecycle history |
| POST | `/api/v1/projects/:projectId/lifecycle-transitions` | JWT | Working; owner/resolver-scoped, ordered path only |
| GET | `/api/v1/projects/:projectId` | JWT | Working |
| GET | `/api/v1/projects/:projectId/milestones` | JWT | Working |
| POST | `/api/v1/projects/:projectId/milestones` | JWT (CLIENT, ADMIN) | Working |
| POST | `/api/v1/milestones` | JWT (CLIENT, ADMIN) | Working |
| GET | `/api/v1/milestones/:milestoneId` | JWT | Working |
| GET | `/api/v1/milestones/:milestoneId/history` | JWT | Working; append-only status history |
| POST | `/api/v1/milestones/:milestoneId/transitions` | JWT | Working; authorization precedes validation |
| POST | `/api/v1/evidence` | JWT | Working |
| GET | `/api/v1/evidence` | JWT | Working |
| POST | `/api/v1/verification` | JWT | Working |
| POST | `/api/v1/attestations` | JWT | Working |
| GET | `/api/v1/attestations` | JWT | Working; scoped by project access |
| POST | `/api/v1/disputes` | JWT | Working |
| GET | `/api/v1/disputes` | JWT | Working |
| GET | `/api/v1/disputes/:disputeId` | JWT | Working |
| POST | `/api/v1/disputes/:disputeId/review` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| POST | `/api/v1/disputes/:disputeId/resolutions` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| POST | `/api/v1/corrections` | JWT | Working |
| GET | `/api/v1/corrections` | JWT | Working |
| GET | `/api/v1/corrections/:correctionId` | JWT | Working |
| POST | `/api/v1/corrections/:correctionId/review` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| POST | `/api/v1/corrections/:correctionId/resolve` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| GET | `/api/v1/variations` | JWT | Working |
| POST | `/api/v1/variations` | JWT (CONTRACTOR, ADMIN) | Working; may append milestone history on approval |
| GET | `/api/v1/variations/:variationId` | JWT | Working |
| POST | `/api/v1/variations/:variationId/review` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| POST | `/api/v1/variations/:variationId/resolve` | JWT (ADMIN, AUDITOR, PROCUREMENT_OFFICER) | Working |
| GET | `/api/v1/blockchain` | JWT | Authorized proof history |
| POST | `/api/v1/blockchain/:eventId/reconcile` | JWT | Receipt-only reconciliation |
| GET | `/api/v1/public/verify` | No | Public verification usage and state explanation |
| POST | `/api/v1/public/verify` | No | Public file comparison against confirmed verification proof |

## Contractors

Authenticated reads only. Role scoping is applied by `contractorListWhere`: privileged read
roles see all contractors, a CLIENT sees all contractors (they must be able to choose one to
assign), and a CONTRACTOR sees only their own record. `passwordHash` is never selected or
returned.

### GET `/api/v1/contractors`

200:

```json
{
  "contractors": [
    {
      "id": "uuid",
      "legalName": "Example Contractor",
      "crbRegistrationNumber": null,
      "crbCategory": null,
      "crbType": null,
      "crbClass": null,
      "crbStatus": null,
      "crbLastVerifiedAt": null,
      "crbSource": null,
      "createdAt": "2026-09-24T07:49:43.000Z",
      "updatedAt": "2026-09-24T07:49:43.000Z"
    }
  ]
}
```

Empty 200: `{ "contractors": [] }`  
401 missing token: `{ "error": { "code": "UNAUTHENTICATED", "message": "missing bearer token", "requestId": "..." } }`\
401 invalid token: `{ "error": { "code": "UNAUTHENTICATED", "message": "invalid or expired token", "requestId": "..." } }`

#### CRB Registration Number discovery filter

`GET /api/v1/contractors?crbRegistrationNumber=<number>` narrows the list to the
contractor whose stored `crbRegistrationNumber` matches. It is an exact,
case-insensitive match against the **ContractorProof contractor record** after
trimming; it is not a fuzzy search and it is not a call to CRB. The filter can
only narrow the caller's existing access set — it never widens it.

200 with a hit: the normal `{ "contractors": [ ... ] }` shape.\
200 with no hit: `{ "contractors": [] }` — an unknown number is a legitimate
empty result, not an error.\
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "crbRegistrationNumber must not be blank" } }`
for a blank value, or `crbRegistrationNumber must be a single value` when the
parameter is repeated. A rejected filter is never downgraded to an unfiltered
listing.

Contractor matching against a live CRB source is not implemented here. The
repository contains a CRB adapter boundary (`src/integrations/crb/`) with a
sandbox adapter and an official adapter that fails closed without authorized
access; the discovery filter above does not depend on it.

### GET `/api/v1/contractors/:contractorId`

200: `{ "contractor": { ...same object as list item... } }`  
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "contractorId must be a valid UUID", "requestId": "..." } }`\
401: same as list  
404: `{ "error": { "code": "CONTRACTOR_NOT_FOUND", "message": "contractor not found", "requestId": "..." } }`

### GET `/api/v1/contractors/:contractorId/passport`

Live Contractor Passport. Same read gate as `GET /api/v1/contractors/:contractorId`
(`assertCanReadContractor`): CLIENT and ADMIN/AUDITOR/PROCUREMENT_OFFICER may read
any contractor; CONTRACTOR may read only their own record.

200: `{ "contractorPassport": { scope, contractor, crbRegistrations, totals, projects } }`

- `scope` — `viewerRole`, `isOwnPassport`, `contractorProjectCount`,
  `withheldProjectDetailCount`, `milestoneCompletionBasis`,
  `verifiedHistoryBasis`, `containsRatings: false`.
- `contractor` — the same public identity and denormalised CRB fields as a
  `/contractors` list item. No account or credential fields are exposed.
- `crbRegistrations` — `{ checkCount, latest, history }`: the append-only
  `CrbVerification` history, newest first, exactly as the existing CRB endpoints
  present it.
- `totals` — `projects`, verified/active project counts, `projectsWithBlockchainProofs`,
  `milestones`, `evidence`, `attestations`, `verification`, `disputes`,
  `corrections` and `blockchainProofs`, keyed by the existing Prisma enum values.
- `projects[]` — compact project history with stable project `id`, name, current
  `lifecycleStatus` and `lifecycleHistory`; milestone identity, status and
  status history; per-project milestone/evidence/verification/attestation/
  dispute/correction summaries; and factual blockchain proof counts. It does
  not embed evidence versions, file metadata, transaction details or proof
  records.
- `verifiedHistory[]` / `activeProjects[]` — the same project objects as
  `projects[]`, partitioned. See below.

Verification counts include each persisted verification record across every
evidence version. Therefore `MATCH` followed by `MISMATCH` remains two factual
observations, and `PENDING` / `UNAVAILABLE` remain distinct enum counts. The
per-project `id` is the stable drill-down reference: request
`GET /api/v1/passports/:projectId` to inspect that project's detailed record.
That endpoint independently enforces project access; seeing a project
reference in a contractor Passport does not grant access to its private detail.

Evidence counters count `Evidence` records by their existing `EvidenceStatus`;
they are not file counts or verification outcomes. `blockchainProofs` counts
the proof event types included by the detailed Project Passport (verification,
attestation, correction, dispute, resolution and variation), with confirmed
and pending counts. `projectsWithBlockchainProofs` is the number of projects
with at least one such event. Project-registration events are not included in
this summary.

There is no score, rating, ranking or recommendation field, and no free-text
reason, comment, file name, storage reference, user ID or authentication field
is returned. A project is only counted in `projectsWithAllMilestonesVerified`
when every milestone it owns has status `VERIFIED`.

#### Verified history versus active projects

`verifiedHistory` and `activeProjects` are a view over the same `projects[]`
array. Nothing is duplicated, re-fetched or stored separately, and every project
appears in exactly one of the two lists.

- `verifiedHistory` — the project has at least one milestone and **every**
  milestone it owns has status `VERIFIED`.
- `activeProjects` — everything else, including projects with no milestones at
  all, which are never treated as complete.

Membership is decided **only** by milestone verification. It deliberately does
not consult the project's administrative `lifecycleStatus`: that field records
how a contract is being administered, not whether the delivered work is
evidenced and verified, so promoting a `COMPLETED` project on that basis alone
would place unverified work into a contractor's historical record. Verified
history therefore states only that work was evidenced and verified — never a
rating, ranking, recommendation or judgement about the contractor.

Project `description` and the owning `clientId` / `clientName` are returned only
when the caller owns the project or holds a privileged read role; otherwise they
are `null` and `clientVisible` is `false`. Factual execution history (project
name, milestones, counts) stays visible so a CLIENT can make the decision.

400: `contractorId must be a valid UUID`\
401: `unauthenticated`\
403: authenticated but not permitted to read this contractor\
404: `CONTRACTOR_NOT_FOUND`

### GET `/api/v1/contractors/me/passport`

Own-passport alias. Resolves the contractor record from the JWT subject rather
than accepting a client-supplied id, so it cannot be used to reach another
contractor's passport.

200: `{ "contractorPassport": { ...same shape... } }` with `scope.isOwnPassport: true`\
401: `unauthenticated`\
404: `CONTRACTOR_NOT_FOUND` when the authenticated user has no contractor record
(for example a CLIENT or ADMIN).

## Project Passports

`GET /api/v1/passports/:projectId` returns the detailed audit record for one
project in the canonical `{ "data": { "passport": ... }, "meta": {} }`
envelope. `GET /api/v1/passports` returns the same projection for projects in
the caller's normal project access set.

The Project Passport includes project and milestone state/history; evidence
versions and SHA-256 hashes; every stored verification outcome and its source
and timestamp; attestations; corrections; disputes and resolutions; variations;
and associated proof references. Proof summaries expose event type, reference,
transaction hash, block, confirmation state and timestamp as available. No
evidence file bytes or storage references are loaded or returned. Internal
actor account IDs are not exposed; recorded roles and applicable audit names
remain factual history fields.

Project Passport access is not widened by a Contractor Passport reference.
The owning CLIENT, assigned CONTRACTOR, ADMIN, AUDITOR and
PROCUREMENT_OFFICER follow the existing project read rules. A CLIENT unrelated
to the project and a CONTRACTOR not assigned to it receive 403. The project ID
shown in a Contractor Passport is only a navigation reference, not an access
token.

Public verification remains separate from both Passport APIs. It returns only
the factual comparison result and, when approved by the existing verification
proof path, the transaction hash and block reference. It does not return
contractor identity, project narrative, evidence metadata or Passport history.

## Projects

Fields are the Prisma `Project` columns plus the contractor and client display names. No nested
contractor/user object, no account fields, and no invented scores.

**Ownership rule.** A project is owned by the CLIENT that created it. `contractorId` records the
assigned contractor, who executes the work but does not own the relationship. The model is
one-directional and is never reversed.

The public payload deliberately omits the raw `clientId`. Ownership is derived server-side from
the authenticated caller and is never accepted from a request body.

Access matrix, applied at the HTTP boundary on every project route:

| Role | Create | Assign contractor | Manage milestones | Read |
| --- | --- | --- | --- | --- |
| CLIENT | yes (becomes owner) | yes, own projects | yes, own projects | own projects |
| ADMIN | yes (no owning client) | yes, any project | yes, any project | any project |
| CONTRACTOR | no | no | no | assigned projects only |
| AUDITOR / PROCUREMENT_OFFICER | no | no | no | any project |
| CONSULTANT_ENGINEER | no | no | no | no project |

`GET /projects` applies the same matrix as a where-clause: privileged roles receive `{}`, a
CLIENT receives `{ clientId: <actor> }`, a CONTRACTOR receives `{ contractor: { userId: <actor> } }`,
and a role with no project relationship receives `{ id: { in: [] } }`.

### GET `/api/v1/projects`

200:

```json
{
  "projects": [
    {
      "id": "uuid",
      "clientName": "Demo Client",
      "contractorId": "uuid",
      "contractorName": "Demo Contractor Ltd",
      "contractorCrbRegistrationNumber": "CRB-DEMO-001",
      "name": "List Project",
      "description": "List Project description",
      "nestTenderReference": "NEST-DEMO-100",
      "nestContractReference": "CNT-DEMO-100",
      "ocid": "ocds-demo-100",
      "procuringEntity": "Demo Procuring Entity",
      "contractStatus": "ACTIVE",
      "lifecycleStatus": "CREATED",
      "contractStartDate": "2026-02-01T00:00:00.000Z",
      "contractEndDate": "2027-01-31T00:00:00.000Z",
      "nestSource": "SYNTHETIC_DEMO",
      "createdAt": "2026-09-24T07:49:43.000Z",
      "updatedAt": "2026-09-24T07:49:43.000Z"
    }
  ]
}
```

`contractorCrbRegistrationNumber` is the assigned contractor's stored discovery identity. It is
`null` until a CRB registration number has actually been recorded; it is never derived, guessed,
or filled in. Projecting it exposes nothing new, because the same value is already readable on
the contractor list and passport by exactly the roles that can reach this route.

Empty 200: `{ "projects": [] }`  
401: same as contractors

### POST `/api/v1/projects`

Canonical envelope: `{ "data": { "project": ... }, "meta": {} }`.

Only CLIENT and ADMIN hold `PROJECT_WRITE`. The body accepts `name` (required), `contractorId`
(required), `description`, `nestTenderReference`, `nestContractReference`, `ocid`,
`procuringEntity`, `contractStatus`, `contractStartDate` and `contractEndDate`.

The owning client is derived from the authenticated caller and **not** from the body: a CLIENT
becomes the owner of the project it creates, and an ADMIN-created project has no owning client.
A `clientId` supplied in the body is ignored.

`contractorId` must reference a `Contractor` whose linked user has the `CONTRACTOR` role.

201: `{ "data": { "project": { ...same object as list item... } }, "meta": {} }`\
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "name is required" } }`, or
`contractorId must be a valid UUID`\
401: `unauthenticated`\
403: `FORBIDDEN` for any role without `PROJECT_WRITE`, which includes every CONTRACTOR\
404: `CONTRACTOR_NOT_FOUND` when `contractorId` does not resolve to a real contractor

### PATCH `/api/v1/projects/:projectId/contractor`

Canonical envelope: `{ "data": { "project": ... }, "meta": {} }`.

Reassignment by the owning CLIENT, or by ADMIN. Body: `{ "contractorId": "uuid" }`.

This route changes the assigned contractor only. It cannot change the owning client, and any
`clientId` in the body is ignored. After a successful reassignment the previous contractor loses
both detail and list access, and the new contractor gains it, because access is derived from the
stored `contractorId` on every request.

200: `{ "data": { "project": { ...same object as list item... } }, "meta": {} }`\
400: `projectId must be a valid UUID` / `contractorId must be a valid UUID`\
401: `unauthenticated`\
403: `FORBIDDEN` when the caller is not the owning client or ADMIN — a CONTRACTOR is always denied\
404: `PROJECT_NOT_FOUND` / `CONTRACTOR_NOT_FOUND`

### GET `/api/v1/projects/:projectId`

200: `{ "project": { ...same object as list item... } }`  
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "projectId must be a valid UUID", "requestId": "..." } }`\
401: same as list  
404: `{ "error": { "code": "PROJECT_NOT_FOUND", "message": "project not found", "requestId": "..." } }`

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
400: `{ "error": { "code": "VALIDATION_ERROR", "message": "projectId must be a valid UUID", "requestId": "..." } }`\
401: same as contractors  
404: `{ "error": { "code": "PROJECT_NOT_FOUND", "message": "project not found", "requestId": "..." } }`

There is no `GET /api/v1/milestones` collection. One milestone is read at a
time, together with its recorded status history.

### Milestone execution

The project execution loop is:

```
CLIENT creates project -> CLIENT creates milestone -> CONTRACTOR records
progress -> CONTRACTOR submits evidence -> CLIENT reviews -> approve, reject,
request correction, or dispute -> verification -> recorded history
```

These are distinct events and are never collapsed into one another. Approval
means the client reviewed this submission and approved it; it is not a
statement that the contractor is trustworthy, and no endpoint returns a score,
rank, rating or verdict.

### `GET /api/v1/milestones/:milestoneId`

200: `{ "milestone": { ...same object as list item... } }`\
400: `milestoneId must be a valid UUID`\
401: `unauthenticated`\
403: authenticated but without project access to the milestone's project\
404: `MILESTONE_NOT_FOUND`

### `GET /api/v1/milestones/:milestoneId/history`

Canonical envelope: `{ "data": { "history": [ ... ] }, "meta": {} }`.

Append-only milestone status history, oldest first. Each entry is a recorded
transition, never a recomputed or summarised value:

```json
{
  "data": {
    "history": [
      {
        "id": "uuid",
        "milestoneId": "uuid",
        "sequence": 0,
        "previousStatus": null,
        "newStatus": "PENDING",
        "actorName": "Demo Client",
        "actorRole": "CLIENT",
        "evidenceId": null,
        "isBaseline": true,
        "reason": null,
        "createdAt": "2026-09-01T09:00:00.000Z"
      },
      {
        "id": "uuid",
        "milestoneId": "uuid",
        "sequence": 1,
        "previousStatus": "PENDING",
        "newStatus": "IN_PROGRESS",
        "actorName": "Demo Contractor",
        "actorRole": "CONTRACTOR",
        "evidenceId": null,
        "isBaseline": false,
        "reason": "Site access granted",
        "createdAt": "2026-09-05T09:00:00.000Z"
      }
    ]
  },
  "meta": {}
}
```

A baseline entry (`previousStatus: null`, `isBaseline: true`) is written when the
milestone is created. For milestones already present when this history was
introduced, the single `BASELINE` row records their known status at migration
time; it does not reconstruct undocumented earlier transitions, which remain
unknown. Transitions after the baseline are recorded as they occur, in unique
per-milestone sequence order. `reason` and `actorName` are recorded only when
the workflow supplied them and are `null` otherwise; neither is ever inferred.
The append-only history is the record of how a milestone reached its status, so
it is never rewritten. Physical milestone deletion leaves its history rows in
the database, and the database trigger rejects direct history updates/deletes.

Access uses the same gate as `GET /milestones/:milestoneId`, so history is
never more visible than the milestone it describes.

400: `milestoneId must be a valid UUID`\
401: `unauthenticated`\
403: authenticated but without project access\
404: `MILESTONE_NOT_FOUND`

### `POST /api/v1/milestones/:milestoneId/transitions`

Canonical envelope: `{ "data": { "milestone": { ... }, "historyEntry": { ... } }, "meta": {} }`.

Records exactly one milestone status transition. Body: `{ "status": "...",
"evidenceId": "uuid", "reason": "..." }`. The transition runs inside a row-locked
transaction and always appends a history entry.

Legal transitions:

| From | To |
| --- | --- |
| `PENDING` | `IN_PROGRESS` |
| `IN_PROGRESS` | `PENDING_VERIFICATION` |
| `REJECTED` | `IN_PROGRESS` |
| `PENDING_VERIFICATION` | `VERIFIED`, `REJECTED` |
| `VERIFIED` | none |

Who may make each transition:

- `CONTRACTOR` assigned to the project: `PENDING`/`REJECTED` → `IN_PROGRESS`, and
  `IN_PROGRESS` → `PENDING_VERIFICATION`. Never `VERIFIED` or `REJECTED`.
- `CLIENT` that owns the project, and `ADMIN`: any legal transition.
- `CLIENT` that does not own the project, and any other role: denied.

`evidenceId` is required for `PENDING_VERIFICATION`, `VERIFIED` and `REJECTED`,
and must belong to the milestone.

#### Check order

Authorization is decided before the rest of the request is examined, so the
status code never depends on how malformed the rest of the body is:

1. `404` if the milestone does not exist.
2. `403` if the caller has no standing on the milestone at all (not an
   assigned `CONTRACTOR`, not the owning `CLIENT`, not an `ADMIN`). A
   non-`UUID` path parameter is rejected earlier with `400`.
3. `400` only if `status` itself is unreadable — the transition cannot be
   identified at all.
4. `403` if the caller may not drive this particular transition. This precedes
   validation of `evidenceId` and `reason`, and precedes the legality check.
5. `400` for a malformed `evidenceId` / `reason`, or a missing `evidenceId` on a
   submission or review transition.
6. `409` if the transition is not legal from the current status.
7. `409` if the required approvals have not been recorded.

The consequence is that a forbidden caller always receives `403`, never a `400`
or `409` that would describe the request or reveal the shape of the state
machine to someone not entitled to drive it. For an authorised caller the order
is unchanged: a missing `evidenceId` is still a `400` and an illegal jump is
still a `409`.

`VERIFIED` additionally requires enough recorded attestations: the milestone's
verification policy `requiredApprovals`, or 1 when it has no policy. A milestone
cannot be marked verified without the client review decisions that justify it.

400: `VALIDATION_ERROR` for an unknown status, a malformed identifier, a missing
   `evidenceId` on a submission or review transition, or a `reason` over 2000
   characters\
401: `unauthenticated`\
403: `FORBIDDEN` when the caller may not move this milestone, or may not move it
   to that status\
404: `MILESTONE_NOT_FOUND` / `EVIDENCE_NOT_FOUND`\
409: `CONFLICT` when the transition is not legal from the current status, or when
   the required approvals have not been recorded

#### Variations

An approved contract variation that changes a milestone's status appends a
`MilestoneStatusHistory` entry in the same transaction as the status change,
with `sequence` continuing the milestone's existing ordering and `reason`
recording the variation reference. A variation that leaves the status untouched
appends nothing. History is therefore never mutated by any path — submission,
review, rework, correction or variation — and remains readable after the
milestone row itself is deleted.

### Project lifecycle and completion

`Project.lifecycleStatus` is the current lifecycle state; append-only records
are available from `GET /api/v1/projects/:projectId/lifecycle-history`. New
projects start at `CREATED` with one baseline history row. Existing projects
received a `CREATED` snapshot when the lifecycle was introduced; this is the
lifecycle's known starting point, not a reconstruction of earlier project
activity.

`POST /api/v1/projects/:projectId/lifecycle-transitions` accepts
`{ "status": "...", "reason": "..." }` and only permits the ordered path:
`CREATED` → `IN_PROGRESS` → `EXECUTION_COMPLETE` → `UNDER_FINAL_REVIEW` →
`COMPLETED`. Each successful transition updates current state and appends one
history row in the same transaction. Repeating a transition or skipping a
state is rejected. `EXECUTION_COMPLETE` additionally requires at least one
milestone and every project milestone to be `VERIFIED`; formal completion
therefore cannot be declared by a button press, contractor claim, or one
verified milestone alone.

This lifecycle is administrative and is deliberately **not** the basis for a
contractor's verified history. `lifecycleStatus` records how the contract is
being administered; the passport's `verifiedHistory` records what was actually
delivered and verified. Both require milestones to be `VERIFIED`, but they are
separate statements about separate things, and completing a lifecycle never by
itself places a project in a contractor's historical record.

The assigned contractor or project-owning client may start execution at
`IN_PROGRESS`. The project-owning client or an `ADMIN` must make the remaining
review/completion transitions. An `ADMIN` may also perform the initial
`IN_PROGRESS` transition. Other clients and unrelated contractors are denied.
Project-history ordering uses a unique per-project sequence, and actor IDs are
not exposed by the API.

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
401: `{ "error": { "code": "UNAUTHENTICATED", "message": "missing bearer token", "requestId": "..." } }` / `{ "error": { "code": "UNAUTHENTICATED", "message": "invalid or expired token", "requestId": "..." } }`\
403: non-ADMIN/non-CONTRACTOR, or CONTRACTOR uploading to another contractor's milestone  
404: ADMIN + unknown milestone

### GET `/api/v1/evidence`

Auth: JWT  
Authz: project access, applied in the database query.  
Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CONTRACTOR: own projects only.  
CLIENT: evidence on the projects they own. CONSULTANT_ENGINEER: empty list (no membership model yet).

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "evidence": [] }, "meta": {} }`.

There is no `GET /api/v1/evidence/:id` in this slice.

## Verification

Canonical route: `POST /api/v1/verification` (singular).  
`/api/v1/verifications` is retired and is not an active API.

Envelope: `{ "data": { "verification": { ... }, "proof": { ... } | null }, "meta": {} }`

`proof` is non-null only when a blockchain registry is configured and the result is anchored; it is never fabricated.

Auth: JWT  
Roles: ADMIN, AUDITOR, PROCUREMENT_OFFICER (project access).  
CLIENT is **not** in this role list and is refused by the gate itself. `CONSULTANT_ENGINEER` passes the role gate but has no project membership model, so it receives 403 on any project.\
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
Envelope: `{ "data": { "attestation": { ... }, "proof": { ... } | null }, "meta": {} }`

`proof` is non-null only when a blockchain registry is configured; an unconfigured registry returns `null` rather than a simulated confirmation.

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
The attestation endpoint records individual decisions; the milestone transition to `VERIFIED` enforces the policy's `requiredApprovals` (or one approval when no policy exists).\
A MATCH verification is **not** required; the domain requires an authoritative `sha256` on the evidence.

`SITE_INSPECTOR` and `CLIENT_REPRESENTATIVE` are verifier labels, not JWT roles.

CLIENT may attest on projects they own, subject to the milestone policy. CONSULTANT_ENGINEER passes the role gate but has no project relationship and receives 403 at project access.

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
401: `{ "error": { "code": "UNAUTHENTICATED", "message": "missing bearer token", "requestId": "..." } }` / `{ "error": { "code": "UNAUTHENTICATED", "message": "invalid or expired token", "requestId": "..." } }`\
403: CONTRACTOR, unauthorized role, uploader self-attest, owner self-attest, policy `ROLE_NOT_ALLOWED`, or no project access  
404: missing evidence or milestone where absence may be revealed  
409: this verifier has already attested this evidence  

GET `/api/v1/attestations` is implemented and returns `{ "data": { "attestations": [ ... ] }, "meta": {} }`, scoped by project access.

Responses never include `passwordHash`, `storageKey`, storage paths, or invented scores.

## Disputes

Canonical routes: `POST /api/v1/disputes` and `GET /api/v1/disputes`.  
Envelope: `{ "data": { "dispute": { ... } }, "meta": {} }` on create.  
List: `{ "data": { "disputes": [ ... ] }, "meta": {} }`.

This is not a correction, variation, attestation, or blockchain event.

Auth: JWT  
Create roles: CONTRACTOR (own project), ADMIN.  
CLIENT passes the create role gate and may raise a dispute on a milestone of a project they own. `CONSULTANT_ENGINEER` has no project membership model → 403.\
AUDITOR / PROCUREMENT_OFFICER cannot create (403).

Read: project access, applied in the database query.  
Privileged read: ADMIN, AUDITOR, PROCUREMENT_OFFICER.  
CONTRACTOR: own projects only.  
CLIENT: evidence on the projects they own. CONSULTANT_ENGINEER: empty list (no membership model yet).

`raisedById` is always the authenticated user. Client-supplied `raisedById`, `actorId`, `userId`, `role`, `status`, `evidenceId`, and `originalEventId` are ignored.

There is no dispute-type enum. The Prisma target is `milestoneId`. Dispute has no `evidenceId` and this slice does not create an EvidenceVersion or BlockchainEvent.

`status` is created as `OPEN`. Clients cannot set `UNDER_REVIEW`, `RESOLVED`, or `REJECTED` on create. Resolution is available at `POST /api/v1/disputes/:disputeId/resolutions` (ADMIN, AUDITOR, PROCUREMENT_OFFICER).

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
401: `{ "error": { "code": "UNAUTHENTICATED", "message": "missing bearer token", "requestId": "..." } }` / `{ "error": { "code": "UNAUTHENTICATED", "message": "invalid or expired token", "requestId": "..." } }`\
403: unauthorized role, or CONTRACTOR using another contractor’s `milestoneId`  
404: ADMIN + unknown milestone  

There is no unique constraint on `(milestoneId, raisedById)`. Duplicate creates are allowed.

### GET `/api/v1/disputes`

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "disputes": [] }, "meta": {} }`.

200: `{ "data": { "disputes": [ ... ] }, "meta": {} }`

Responses never include `passwordHash`, `storageKey`, storage paths, blockchain event internals, or invented scores.

`GET /api/v1/disputes/:disputeId`, `POST /api/v1/disputes/:disputeId/review` and `POST /api/v1/disputes/:disputeId/resolutions` all exist.

## Corrections

Authenticated endpoints: `POST /api/v1/corrections`, `GET /api/v1/corrections`, `GET /api/v1/corrections/:correctionId`, `POST /api/v1/corrections/:correctionId/review`, and `POST /api/v1/corrections/:correctionId/resolve`.

All correction responses use `{ "data": ..., "meta": {} }`; domain errors use `{ "error": { "code", "message", "requestId" } }`. Authentication middleware retains the established 401 response.

Creation stores OPEN. A resolver transitions OPEN → UNDER_REVIEW → APPROVED/REJECTED. Review retries at UNDER_REVIEW are idempotent. The terminal result, note, resolver, timestamp, and optional corrected version are appended to one `CorrectionResolution` row; matching resolution retries return it, conflicting retries return 409. Distinct correction requests are allowed because the domain defines no uniqueness key.

Create roles: CONTRACTOR on an assigned project, CLIENT on a project they own, and ADMIN. CONSULTANT_ENGINEER passes the role gate but has no project relationship and is denied at project access. Read access follows project access: CONTRACTOR sees assigned projects; CLIENT sees owned projects; ADMIN, AUDITOR, and PROCUREMENT_OFFICER follow the privileged read rules. Resolver roles are ADMIN, AUDITOR, PROCUREMENT_OFFICER. Client-supplied actor/status fields are ignored.

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
401: `{ "error": { "code": "UNAUTHENTICATED", "message": "missing bearer token", "requestId": "..." } }` / `{ "error": { "code": "UNAUTHENTICATED", "message": "invalid or expired token", "requestId": "..." } }`\
403: unauthorized role, or CONTRACTOR using another contractor’s `milestoneId`  
404: ADMIN + unknown milestone; missing original event or evidence after write access  

There is no unique constraint. Duplicate creates are allowed.

### GET `/api/v1/corrections`

Optional query: `milestoneId`, `projectId`. Inaccessible filters return `{ "data": { "corrections": [] }, "meta": {} }`.

200: `{ "data": { "corrections": [ ... ] }, "meta": {} }`

`GET /api/v1/corrections` accepts optional `milestoneId` and `projectId` filters. `GET /:correctionId` returns one record after project authorization. Review has an empty body. Resolve body: `{ "status": "APPROVED" | "REJECTED", "resolution": "...", "correctedEvidenceVersionId?": "uuid" }`.

Responses never include `passwordHash`, storage keys/paths, or private infrastructure secrets. Transaction hash and block number are exposed only as fields of an explicitly `CONFIRMED` or `PENDING` proof object.

## Variations

All routes require JWT authentication. `CONTRACTOR` and `ADMIN` may create for a project; contractors are restricted to their own projects. `ADMIN`, `AUDITOR`, and `PROCUREMENT_OFFICER` may review and resolve. Project reads follow the established access helper.

`POST /api/v1/variations` body:

```json
{
  "projectId": "uuid",
  "milestoneId": "uuid",
  "previousEventId": "uuid",
  "variationReference": "VO-001",
  "reason": "Scope adjustment",
  "evidenceId": "uuid",
  "changes": {
    "project": { "name": "Revised project name" },
    "milestone": { "description": "Revised deliverables" }
  }
}
```

At least one supported project or milestone field must change. `milestoneId` and `evidenceId` are optional unless milestone changes or related evidence are supplied. The previous BlockchainEvent must belong to the project. A project/reference pair is unique; repeating that reference returns 409.

Lifecycle: `OPEN` → `UNDER_REVIEW` → `APPROVED` or `REJECTED`. Resolution body: `{ "status": "APPROVED" | "REJECTED", "decision": "...", "note": "..." }`. Identical resolutions are idempotent; conflicting resolutions return 409. Approval applies only the proposed fields and stores the original project/milestone snapshot and resolution. Rejection does not apply proposed changes.

Routes: `GET /api/v1/variations?projectId=uuid`, `GET /api/v1/variations/:variationId`, `POST /api/v1/variations/:variationId/review`, `POST /api/v1/variations/:variationId/resolve`. Responses use `{ "data": ..., "meta": {} }`.

The contract already supports `recordVariation`. When a writable registry is configured, approved variations with a confirmed source event create a pending `BlockchainEvent` before submission and confirm only after a successful receipt. Failures remain pending and identical approval retries reuse the logical event. An unconfirmed source or unavailable registry creates no variation proof. Passport exposes original/proposed snapshots, decisions, and proof state.

## Blockchain proof history and reconciliation

`GET /api/v1/blockchain?projectId=<uuid>` returns safe event metadata only for projects readable by the JWT actor. Contractors are limited to their own projects; ADMIN, AUDITOR, and PROCUREMENT_OFFICER use existing privileged project-read access.

`POST /api/v1/blockchain/:eventId/reconcile` inspects only the receipt for an already-stored transaction hash. A successful receipt with a positive block number confirms that same row. Reverted/unavailable receipts, provider errors, and events without a transaction hash remain pending. It never submits a transaction or overwrites a confirmed event.

Public POST verify requires a confirmed `VERIFICATION` proof before returning MATCH or MISMATCH. Pending/unconfirmed proof returns PENDING; missing or inconsistent proof returns UNAVAILABLE. MATCH establishes fingerprint integrity only and does not prove the underlying construction claim.
