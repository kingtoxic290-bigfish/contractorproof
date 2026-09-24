# ContractorProof Frozen Specification

This document summarizes the frozen ContractorProof product specification. It does not add product requirements.

Implementation architecture, API envelopes, and agent boundaries: [docs/architecture/](architecture/README.md). Where this spec and the architecture baseline both speak (Passport storage, hash fields, verification vs attestation), follow the architecture ADRs.

## Product definition

ContractorProof is an evidence-verification and provenance layer for construction projects.

It connects:

1. Project
2. Milestone
3. Evidence
4. Cryptographic fingerprint
5. Authorized professional attestation
6. Tamper-evident blockchain event
7. Performance Passport
8. Independent evidence verification

## What ContractorProof is not

ContractorProof does **not** replace:

- CRB contractor registration
- PPRA
- NeST procurement
- professional engineering inspection
- government systems

The MVP works with **synthetic** CRB and NeST references. Live institutional APIs are not assumed.

## Integrity claim

Blockchain proves integrity of the recorded evidence or event.

Blockchain does **not** prove that the underlying construction claim is true.

ContractorProof does **not** calculate a contractor trust score.

## Frozen technology stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | Node.js, Express, TypeScript, REST, JWT, RBAC, Prisma |
| Database | PostgreSQL |
| Evidence storage | Controlled local filesystem for MVP; storage interface allows MinIO later |
| Evidence integrity | SHA-256 |
| Blockchain | Hardhat, Solidity, ethers.js, local Ethereum-compatible network |
| Testing | Vitest, Supertest, Hardhat tests |

## Roles

- `CONTRACTOR`
- `CLIENT`
- `CONSULTANT_ENGINEER`
- `PROCUREMENT_OFFICER`
- `AUDITOR`
- `ADMIN`

A contractor **must not** verify or attest their own evidence.

`SITE_INSPECTOR` and `CLIENT_REPRESENTATIVE` are verifier-policy labels, not additional login roles in this MVP.

## Domain

- User
- Contractor
- Project
- Milestone
- Evidence
- VerificationPolicy
- Attestation
- Dispute
- Correction
- ContractVariation
- AuditLog
- BlockchainEvent

There is no contractor rating or trust-score model.

## Institutional references

Contractor records support synthetic CRB fields:

- `crbRegistrationNumber`
- `crbCategory`
- `crbType`
- `crbClass`
- `crbStatus`
- `crbLastVerifiedAt`

Project records support synthetic NeST fields:

- `nestTenderReference`
- `nestContractReference`
- `ocid`
- `procuringEntity`
- `contractStatus`
- `contractStartDate`
- `contractEndDate`

Access is through adapters:

- `CrbIntegrationAdapter` / `MockCrbIntegrationAdapter`
- `NestIntegrationAdapter` / `MockNestIntegrationAdapter`

Mock adapters are labeled as synthetic/demo data. They do not call live APIs.

## Core workflow

Contractor → Project → Milestone → Evidence Upload → SHA-256 → Verification Policy → Authorized Verifier(s) → Attestation → Blockchain Anchor → Immutable Event → Performance Passport → Public Verification (MATCH / MISMATCH)

Additional workflows: disputes, corrections, contract variations, audit trail, multi-party verification.

## Immutability

Historical verification events are never overwritten.

If something changes, the original event remains and a new correction, resolution, or variation event is created.

## Evidence

1. Receive file
2. Validate file
3. Store file locally
4. Calculate SHA-256
5. Store metadata and hash in PostgreSQL
6. Associate evidence with a milestone
7. Set initial status to `PENDING_VERIFICATION`

Evidence files and sensitive personal information are **not** stored on-chain. The chain receives hashes and event metadata or references only.

## Verification and attestation

Verification policies configure required approvals and allowed verifier roles.

Simple milestones may use single-party verification. Critical milestones may require multiple authorized attestations.

A milestone becomes `VERIFIED` only after its policy is satisfied.

Attestation decisions: `APPROVED` or `REJECTED`.

Unauthorized roles cannot create attestations.

## Disputes, corrections, variations

Dispute states: `OPEN`, `UNDER_REVIEW`, `RESOLVED`, `REJECTED`.

A resolution references the original dispute and verification event.

Corrections and contract variations create new linked events. The original event stays accessible.

## Public verification

A user can submit a file, calculate SHA-256, compare it to the recorded fingerprint, and see `MATCH` or `MISMATCH`.

`MATCH` means the submitted file matches the recorded evidence fingerprint. It does not mean the blockchain independently proves the underlying claim is true.

## On-chain data rule

Do not put passwords, national IDs, phone numbers, addresses, private documents, private contract terms, or full evidence files on-chain.

Use `bytes32` for SHA-256 hashes where appropriate. Emit events for auditability.
