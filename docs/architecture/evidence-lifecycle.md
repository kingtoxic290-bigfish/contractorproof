# Evidence Lifecycle

Status: frozen by Agent 0 (2026-09-24)  
Decision record: [ADR-0005](adr/ADR-0005-evidence-versioning.md)

## Official lifecycle

```
Upload
  → Validate
  → Store
  → SHA-256
  → EvidenceVersion
  → Evidence metadata
  → PENDING
  → Verification (MATCH or MISMATCH)
  → Policy evaluation
  → Authorized Attestation
  → Blockchain Proof
  → Blockchain confirmation
  → Public / Passport projection
```

## Rules

1. Files are never silently overwritten. A replacement is a new `EvidenceVersion` linked to the same `Evidence`.
2. Historical versions stay readable. Corrections create a linked new record (`Correction` + new version), they do not DELETE or UPDATE bytes or `sha256` of an old version.
3. `storageReference` is opaque. APIs do not return filesystem paths.
4. Hashing happens on the backend after store (or on the buffer before persist; same bytes). The frontend may show a progress hash but it is not authoritative.
5. Algorithm: SHA-256 of raw file bytes. Canonical application form: lowercase hex, 64 characters (`backend/src/utils/hash.ts` `sha256Buffer`).
6. On-chain form: those 32 raw hash bytes as Solidity `bytes32`. Do not keccak the hex string and call that the evidence hash.
7. Unique current constraint: one live hash per milestone may remain as `(milestoneId, sha256)` on the current version; superseded versions keep their hash rows.
8. `Evidence.sha256` is a denormalized copy of the **current** `EvidenceVersion.sha256` for queries. It is not a second algorithm and must be updated only when current version changes.
9. `BlockchainEvent.evidenceHash` is a copy of the **proven** `EvidenceVersion.sha256`, not an independently computed digest.
10. **Storage key (Agent 3):** `EvidenceVersion.storageReference` is canonical per version. `Evidence.storageKey` is a denormalized copy of the current version’s reference (dual-write). Do not drop `storageKey` in this phase.

## Validation (Agent 5)

Minimum before store:

- Authenticated actor with permission to add evidence on that milestone
- Non-empty buffer
- Size cap (define in implementation; JSON 2mb limit is not the file limit)
- MIME / extension allow-list
- `originalName` used only for display and extension; storage key is server-generated (existing UUID + extension pattern is acceptable)

## Storage

Reuse `StorageService` and `LocalFilesystemStorageService`. Read path already uses `path.basename`. Keep that. MinIO later implements the same interface. No second storage API.

File cap: `EVIDENCE_MAX_FILE_BYTES` (25 MiB) in `backend/src/services/evidence/config.ts`. This is not the Express JSON 2mb limit.

### Filesystem / PostgreSQL compensation (Agent 5)

Store and database writes are not one atomic transaction.

1. Validate and hash the buffer.
2. `StorageService.save`.
3. Write `Evidence` / `EvidenceVersion`.
4. If step 3 fails, `StorageService.remove` the new key.

A crash between 2 and 4 can leave an unreferenced object. The service never leaves Evidence metadata pointing at a file that was not stored. Agent 2 must not persist client storage keys.

## What Agent 5 must wire (not present today)

| Step | Existing code | Gap |
| --- | --- | --- |
| HTTP upload | POST `/api/v1/evidence` is 501 | Multipart + controller |
| Validate | Missing | Implement |
| Store | `localStorageService.save` unused | Call it |
| Hash | `sha256Buffer` unused | Call it |
| Version row | Model missing | Agent 3 adds `EvidenceVersion` |
| Overwrite | N/A | Forbidden |

## Corrections and variations

`Correction` and `ContractVariation` already point at a previous `BlockchainEvent` and optional new `evidenceId`. They must attach a new `EvidenceVersion` (or new Evidence) rather than mutate the old `sha256`.
