# System Overview

Status: frozen by Agent 0 (2026-09-24)  
Supersedes narrative architecture in `docs/ARCHITECTURE.md` where they differ.

ContractorProof is an evidence-verification and provenance layer for construction projects. It does not replace CRB, NeST, PPRA, contractor registration, procurement, or professional inspection.

Blockchain proves integrity of a recorded evidence fingerprint or event. It does not prove that the underlying construction claim is true.

The product does not calculate a trust score, security score, compliance percentage, or safety score.

## Canonical stack (do not replace)

| Layer | Path | Technology |
| --- | --- | --- |
| Frontend | `frontend/` | React 18, Vite 6, TypeScript, Tailwind 3, React Router 6 |
| Backend | `backend/` | Node.js, Express 4, TypeScript, Prisma 6 |
| Database | `backend/prisma/` + Compose PostgreSQL 16 | Prisma Migrate |
| Evidence binaries | `backend/storage/` via `StorageService` | Local filesystem now; MinIO later through the same port |
| Blockchain | `contracts/` | Solidity 0.8.24, Hardhat, ethers v6, `ContractorProofRegistry` |

This is not a greenfield rewrite. Agents extend the existing packages.

## Canonical request path

```
React frontend
  → frontend/src/services/api/client.ts
  → Express /api/v1/*
  → authenticate + authorize + ownership
  → controllers
  → application services
  → PostgreSQL (Prisma) + evidence storage
  → verification (SHA-256 compare)
  → policy + authorized attestation
  → blockchain proof (backend wallet only)
  → Passport / PublicVerification projection
```

The backend is the authoritative orchestration and authorization boundary.

## Frozen terminology

| Concept | Meaning |
| --- | --- |
| User | Authenticated account |
| Role | One of the six login roles |
| Permission | Capability derived from role plus resource ownership. Not a separate table in Phase 1 |
| Contractor | Business profile (1:1 with a CONTRACTOR user) |
| Project | Work record owned by a Contractor |
| Milestone | Scoped work item on a Project |
| Evidence | Logical evidence item on a Milestone |
| EvidenceVersion | Immutable stored file + SHA-256 for one Evidence item |
| sha256 | Canonical hex-encoded SHA-256 of file bytes |
| storageReference | Opaque key from `StorageService` (`storageKey` today) |
| Verification | Fingerprint comparison against the authoritative hash/proof |
| MATCH / MISMATCH / PENDING / UNAVAILABLE | Verification results only |
| Attestation | Authorized actor decision against a VerificationPolicy |
| VerificationPolicy | Required approvals and allowed verifier roles |
| BlockchainEvent | Application record of an on-chain write |
| Proof | Confirmed on-chain integrity record (tx hash, block, evidence hash) |
| Passport | Derived public projection of a project's attested, proven evidence |
| PublicVerification | Unauthenticated file-to-fingerprint compare |
| AuditLog | Append-only application audit row |

Forbidden competing names unless a future ADR introduces them: Fingerprint (as a type), Checksum, TrustScore, SecurityScore, ComplianceScore, SafetyScore.

## What exists vs what is frozen for implementation

| Area | Today | After agents implement |
| --- | --- | --- |
| Auth login/register/me | Working | Keep; tighten roles and JWT config |
| Domain HTTP APIs | 501 stubs | Implement against this baseline |
| Prisma schema | Ahead of code | Agent 3 adds EvidenceVersion; no Passport table |
| SHA-256 + storage port | Unused utilities | Agent 5 + Agent 2 wire them |
| Public verify | Scaffold GET + 501 POST | Agent 7 implements compare |
| Contract | Tested, unused by API | Agent 4 + Agent 2 wire after attestation |

## Related documents

- [Component boundaries](component-boundaries.md)
- [Data flow](data-flow.md)
- [Evidence lifecycle](evidence-lifecycle.md)
- [Verification model](verification-model.md)
- [Blockchain model](blockchain-model.md)
- [Authentication model](authentication-model.md)
- [Integration rules](integration-rules.md)
- [Repository inventory](repository-inventory.md) (factual snapshot; this freeze overrides its open questions)
