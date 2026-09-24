# Blockchain Model

Status: frozen by Agent 0 (2026-09-24)  
Decision record: [ADR-0002](adr/ADR-0002-blockchain-proof-boundary.md)

## Role of the chain

`ContractorProofRegistry` is an integrity / proof layer. PostgreSQL remains the application source of truth for users, files, RBAC, lists, and policy.

The chain stores minimum proof data: `bytes32` identifiers, `bytes32 evidenceHash`, actor id, booleans, timestamps.

## Canonical contract

- File: `contracts/contracts/ContractorProofRegistry.sol`
- Solidity: `^0.8.24` (Hardhat 0.8.24)
- Tooling: Hardhat, ethers v6, `contracts/scripts/deploy.ts`
- Networks: `hardhat`, `localhost` (`RPC_URL`)

Do not replace Hardhat or add a second registry contract unless a new ADR says so.

## What is written on-chain

| Function | When (application) |
| --- | --- |
| `registerProject` | After a Project is created and is ready to be bounded on-chain |
| `recordAttestation` | After each persisted Attestation that should be anchored |
| `recordVerification` | When milestone policy is satisfied (application verification event) |
| `recordCorrection` | After a Correction is persisted |
| `recordDispute` / `recordResolution` | After those records |
| `recordVariation` | After a ContractVariation is persisted |

Off-chain file compare (MATCH) is **not** itself an on-chain transaction. MATCH can exist before proof. Proof is created after authorized attestation / policy, per the official lifecycle.

## Identifiers on-chain

| Field | Encoding |
| --- | --- |
| `projectId`, `eventId`, `actorId`, `milestoneId`, `contractorId`, `variationRef` | `keccak256(utf8(uuid-or-stable-string))` (`ethers.id` / `ethers.keccak256(ethers.toUtf8Bytes(...))`) |
| `evidenceHash` | SHA-256 digest of file bytes as `bytes32` (32 raw bytes), not keccak of the hex string |

Agent 4 must implement these helpers once and reuse them. Do not mix encodings.

## Proof vs BlockchainEvent

| Term | Definition |
| --- | --- |
| BlockchainEvent | PostgreSQL row: `eventType`, `referenceId`, `previousEventId`, `txHash`, `blockNumber`, `evidenceHash`, `actorId` |
| Proof | The confirmed integrity slice: `txHash` + `blockNumber` + `evidenceHash` + on-chain `eventId` once the transaction is mined |

There is no separate `Proof` table in Phase 1. Proof is `BlockchainEvent` with a non-null `txHash`.

`BlockchainEvent.evidenceHash` **must** equal the proven `EvidenceVersion.sha256` hex.

## Key custody

- `BLOCKCHAIN_PRIVATE_KEY` is server-only (backend env / Hardhat).
- Frontend never receives the key and never calls `eth_sendTransaction`.
- `BlockchainService.getSignerContract()` stays in `backend/src/blockchain/`.
- Empty key on local Hardhat is allowed for node accounts; production must fail if the key or `CONTRACT_ADDRESS` is missing (Agent 4 + Agent 6 config).

## Adapter

Keep `BlockchainService`. Agent 4 should stop maintaining a hand-written partial ABI as the long-term source of truth and bind to compiled artifacts / TypeChain from `contracts/`. Until that swap, do not add a second adapter.

`isConfigured()` already requires `CONTRACT_ADDRESS`. Domain services must not pretend a proof exists when the adapter is unconfigured — return PENDING/UNAVAILABLE.

## Forbidden

- Evidence files or PII on-chain
- Frontend wallets as the system recorder
- Overwriting an on-chain `eventId` (contract already reverts)
- Using chain event existence as “the building is safe”
