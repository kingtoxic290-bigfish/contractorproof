# Agent 4 — Blockchain

## Owns

`contracts/`, `backend/src/blockchain/BlockchainService.ts`, deploy script, id/hash encoding.

## Canonical dependencies

- `ContractorProofRegistry.sol` 0.8.24
- Hardhat + ethers v6
- ADR-0002

## Must do (Phase 2 foundations)

- Keep contract hash-only
- Encoding: evidence SHA-256 raw `bytes32`; other ids `keccak256(utf8(id))`
- Bind adapter to compiled ABI / TypeChain instead of a drifting handwritten subset
- Fail closed in production if `CONTRACT_ADDRESS` or signing key missing
- Expose service methods for registerProject, recordAttestation, recordVerification, correction/dispute/variation
- Do not call those from HTTP until Agent 2 orchestration exists

## Must not

- Put files or PII on-chain
- Add frontend chain access
- Replace Hardhat with Foundry without an ADR
- Treat event existence as construction truth

## Depends on

Local Hardhat + `CONTRACT_ADDRESS`. Agent 2 calls after attestation/policy.
