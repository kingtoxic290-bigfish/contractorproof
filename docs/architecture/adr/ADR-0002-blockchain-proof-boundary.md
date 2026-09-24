# ADR-0002 Blockchain proof boundary

## Status

Accepted (Agent 0, 2026-09-24)

## Context

`ContractorProofRegistry` already stores `bytes32` ids and hashes. `BlockchainService` exists but is unused. Prisma has `BlockchainEvent` with `evidenceHash` and `txHash`. Product language also says “Proof”.

## Decision

The chain is an integrity layer only. PostgreSQL is the application authority.

- Do not store files or PII on-chain.
- `BlockchainEvent` is the application row for an on-chain write.
- **Proof** means a confirmed `BlockchainEvent` (`txHash` set) plus the copied `evidenceHash`. No `Proof` table in Phase 1.
- `BlockchainEvent.evidenceHash` is a copy of the proven `EvidenceVersion.sha256`, not a second hash algorithm.
- Only the backend wallet records. Frontend never holds `BLOCKCHAIN_PRIVATE_KEY`.
- Off-chain MATCH does not require a transaction. Proof is written after authorized attestation / policy satisfaction.
- On-chain `evidenceHash` is the 32-byte SHA-256 digest. Other ids use `keccak256(utf8(stable-id))`.

## Alternatives Considered

- Proof as its own table — deferred; duplicates `BlockchainEvent`.
- Hash-on-chain at upload, before attestation — rejected for the official lifecycle (proof follows attestation).
- Browser wallet as recorder — rejected; breaks custody and RBAC.

## Consequences

- Agent 4 wires `BlockchainService` to artifacts/TypeChain and the encoding helpers.
- Agent 2/5 must not mark proof complete without `txHash`.
- Agent 3 does not add a Proof model unless a later ADR requires it.

## Affected Agents

4, 2, 3, 5, 7, 8, 9
