# Blockchain identifier encoding

Status: Agent 4 (2026-09-24)

Canonical helpers: `backend/src/blockchain/encoding.ts`

## Evidence hash → bytes32

```
EvidenceVersion.sha256
  64 lowercase hex characters
  → decode 32 raw bytes
  → bytes32
```

Do **not** `keccak256` the hex string. That would be a different fingerprint.

Invalid length or non-hex input is rejected.

## Application UUID / stable id → bytes32

Frozen by Agent 0 (ADR-0002):

```
keccak256(utf8(uuid-or-stable-string))
```

Same as `ethers.id(id)` / `ethers.keccak256(ethers.toUtf8Bytes(id))`.

This is deterministic and collision-resistant for the UUID space. It is **not reversible**. PostgreSQL remains the source of the original identifier. `BlockchainEvent` stores the application UUID; the chain stores the keccak id.

Applies to: `projectId`, `eventId`, `actorId`, `milestoneId`, `contractorId`, `variationRef`.
