# Data Model

Status: Agent 3 Phase 2 foundations applied  
Schema: `backend/prisma/schema.prisma`  
Owner: Agent 3

Init migration: `backend/prisma/migrations/20260924120000_init/`  
Versioning migration: `backend/prisma/migrations/20260924180000_evidence_versioning/`

## Keep

Existing models: User, Contractor, Project, VerificationPolicy, Milestone, Evidence, Attestation, BlockchainEvent, Dispute, Correction, ContractVariation, AuditLog.

Existing workflow enums: Role, EvidenceStatus, MilestoneStatus, AttestationDecision, DisputeStatus, BlockchainEventType.

CRB/NeST fields and `SYNTHETIC_DEMO` defaults are unchanged.

## Added

### EvidenceVersion

Immutable stored file + SHA-256. No `updatedAt`. Do not UPDATE `sha256` or `storageReference` after insert.

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID PK | |
| evidenceId | FK Evidence | Restrict; exactly one parent |
| versionNumber | Int | Monotonic per evidence, starting at 1 |
| storageReference | String | **Canonical storage key for this version** |
| fileName, mimeType, sizeBytes | | Version metadata |
| sha256 | String | **Canonical hash**, lowercase hex, 64 chars |
| createdById | FK User, optional | SetNull |
| createdAt | DateTime | |

Uniques: `(id, evidenceId)`, `(evidenceId, versionNumber)`, `(evidenceId, sha256)`

### Verification

Append-only fingerprint compare. **Not** `EvidenceStatus`.

| Field | Type | Notes |
| --- | --- | --- |
| id | UUID PK | |
| evidenceVersionId | FK EvidenceVersion | Restrict |
| status | VerificationStatus | MATCH / MISMATCH / PENDING / UNAVAILABLE |
| presentedSha256 | String? | Hash of presented bytes; null if not computed |
| authoritativeSha256 | String | Copy of version sha256 at compare time |
| source | VerificationSource | INTERNAL / PUBLIC |
| requestedById | FK User, optional | Null for anonymous public verify |
| createdAt | DateTime | No updatedAt |

### Enums added

- `VerificationStatus`: MATCH, MISMATCH, PENDING, UNAVAILABLE
- `VerificationSource`: INTERNAL, PUBLIC

## Evidence (modified)

| Change | Why |
| --- | --- |
| `currentVersionId` nullable unique FK | Pointer to current `EvidenceVersion` |
| Composite FK `(currentVersionId, id)` → `(EvidenceVersion.id, evidenceId)` | Current version cannot belong to another Evidence |
| `sha256` | Denormalized **current** version hash |
| `storageKey` | Denormalized **current** version `storageReference` |
| `fileName`, `mimeType`, `sizeBytes` | Denormalized current metadata |
| `@@unique([milestoneId, sha256])` kept | Uniqueness of the **current** hash on a milestone. Historical hashes stay on versions |

`status` remains workflow: `PENDING_VERIFICATION` / `VERIFIED` / `REJECTED`.

## Storage key decision

**Decision: dual-write. Canonical per version is `EvidenceVersion.storageReference`. `Evidence.storageKey` is a denormalized copy of the current version.**

Chosen because:

- Existing `Evidence.storageKey` is NOT NULL and may already be read by future Agent 5 code
- Dropping it now would be a breaking, destructive change
- The same pattern as `Evidence.sha256` (denormalized current hash)
- Migration backfills grandfathered `Evidence` rows as version 1 (`storageReference = storageKey`) so they stay readable

Repository `createWithInitialVersion` / `appendVersion` / `setCurrentVersion` always write both together so they cannot disagree.

Bytes stay in `StorageService`. PostgreSQL stores keys and hashes only.

## Verification persistence decision

**Decision: persist Verification rows.**

Why not ephemeral:

- Auditability of MATCH/MISMATCH (who/when/which version)
- Public verification history without overloading `AuditLog`
- Traceability to `EvidenceVersion`
- Workflow `EvidenceStatus` must not store MATCH

Agent 5/7 write these rows when they implement compare. Agent 3 only provides the table and repository.

## Not added

| Model | Reason |
| --- | --- |
| Passport | Derived projection (ADR-0007) |
| Proof | Confirmed `BlockchainEvent` (ADR-0002) |
| Permission | Role + ownership |
| Score tables | Forbidden |

## Hash columns

| Column | Role |
| --- | --- |
| EvidenceVersion.sha256 | Authority |
| Evidence.sha256 | Copy of current version |
| BlockchainEvent.evidenceHash | Copy of the proven version sha256 |
| Verification.authoritativeSha256 | Copy at compare time |
| Verification.presentedSha256 | Presented file hash |

One algorithm: SHA-256. CHECK constraints require `^[0-9a-f]{64}$`.

## Current version integrity

- `Evidence.currentVersionId` unique (one version is current for at most one evidence)
- Composite FK forces `currentVersion.evidenceId = Evidence.id`
- Repository `setCurrentVersion` also rejects cross-evidence ids
- Historical versions remain rows; changing current only updates Evidence denormalized fields

## Historical immutability — limitations

Prisma cannot mark columns read-only. There are no UPDATE/DELETE triggers (not required by this architecture).

Guarantees in this change:

- No `updatedAt` on `EvidenceVersion` or `Verification`
- `evidenceVersion.repository` has find methods only
- `evidence.repository` creates versions; it never updates version hash/storage fields
- Unique `(evidenceId, sha256)` blocks inserting the same digest twice on one evidence
- SQL CHECKs on hash format and `versionNumber > 0`

A privileged SQL client can still UPDATE a version row. Agent 5/2 must use the repositories. A later ADR would be required for triggers.

## Ownership graph

```
User 1─1 Contractor 1─* Project 1─* Milestone 1─* Evidence 1─* EvidenceVersion
Evidence 0─1 current EvidenceVersion (same evidenceId)
EvidenceVersion 1─* Verification
Milestone *─1 VerificationPolicy
Evidence 1─* Attestation
Project 1─* BlockchainEvent
```

## Repositories

| File | Role |
| --- | --- |
| `user.repository.ts` | Unchanged |
| `evidence.repository.ts` | Create evidence+v1, append version, set current, workflow status |
| `evidenceVersion.repository.ts` | Reads only |
| `verification.repository.ts` | Append-only create + reads |
| `sha256.ts` | Hex normalize/validate |
| `errors.ts` | `RepositoryError` |

## Indexes and constraints added

See migration `20260924180000_evidence_versioning`. Foreign keys use Restrict except `createdById` / `requestedById` SetNull.
