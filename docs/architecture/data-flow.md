# Data Flow

Status: frozen by Agent 0 (2026-09-24)

## Golden path

```
User login (JWT)
  → authorized role
  → Contractor (profile; auto-created today when role is CONTRACTOR)
  → Project
  → Milestone (+ VerificationPolicy)
  → Evidence upload
  → validate
  → store (storageReference)
  → SHA-256
  → EvidenceVersion (authoritative sha256)
  → Evidence metadata (currentVersionId, denormalized sha256)
  → verificationStatus PENDING until a compare is requested
  → Verification compare → MATCH or MISMATCH
  → if MATCH: policy evaluation
  → authorized Attestation (assertCanAttest)
  → when policy satisfied: Blockchain Proof
  → BlockchainEvent confirmed (txHash, blockNumber)
  → Passport projection updated (derived)
  → PublicVerification of the same file → MATCH
```

No agent may skip store → hash → version → authz → attestation → proof.

## Tamper path

```
Original bytes → SHA_A stored on EvidenceVersion and copied to Proof
Modified bytes → SHA_B
SHA_A != SHA_B → Verification result MISMATCH
```

MISMATCH must not be rewritten to MATCH, VERIFIED, or “safe”.

## Write vs read

| Action | Writer | Readers |
| --- | --- | --- |
| Register / login | Auth service | Frontend session |
| Create project / milestone | Domain services after authz | Project members by ownership/role |
| Upload evidence | Evidence service | Same; public verify sees hash + public projection only |
| Verify file | Verification service | Caller; public verify returns status only |
| Attest | Attestation service after `assertCanAttest` | Project members; passport shows decision not private comments if restricted |
| Record proof | BlockchainService (server wallet) | Passport, audit, public proof fields |
| AuditLog | Services on state-changing actions | AUDITOR, ADMIN, PROCUREMENT_OFFICER |

## Institutional data

CRB and NeST lookups stay behind adapters. Responses must keep `source: "SYNTHETIC_DEMO"` until a live-adapter ADR. Frontend must display them as synthetic. Do not use lookup success as VERIFIED or MATCH.

## Error and unavailability

| Condition | Verification status | HTTP |
| --- | --- | --- |
| Compare completed, hashes equal | MATCH | 200 |
| Compare completed, hashes differ | MISMATCH | 200 |
| Upload stored, no compare requested yet | PENDING | 200 on get |
| Storage, database, or chain required data missing | UNAVAILABLE | 200 on verify if the compare cannot run; 503 if the API itself is down |
| Unauthorized attest | — | 403 |
| Unauthenticated protected route | — | 401 |

Do not map “API reachable” to protected, “no threats” to safe, or “no evidence” to verified.

## Sequence: upload through proof

1. Agent 2 receives multipart upload after Agent 6 authn/authz and ownership of the milestone.
2. Agent 5 validates, stores, hashes, writes EvidenceVersion.
3. Agent 5/2 set verification on that version to PENDING until compared; an upload’s own hash is the authority, so a self-compare of the stored bytes must MATCH. Public or later compares use the stored authority.
4. Authorized verifier submits Attestation. Agent 6 `assertCanAttest` runs before persist.
5. Agent 2 evaluates VerificationPolicy (`requiredApprovals`, `allowedRoles`).
6. When satisfied, Agent 4 submits `recordAttestation` / `recordVerification` from the backend. Agent 3 persists `BlockchainEvent` with the same `evidenceHash` as `EvidenceVersion.sha256`.
7. Agent 7 derives Passport; public POST compare returns MATCH or MISMATCH.
