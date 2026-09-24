# Component Boundaries

Status: frozen by Agent 0 (2026-09-24)

## Package ownership

| Package | Owner agent | May import | Must not |
| --- | --- | --- | --- |
| `frontend/` | Agent 1 | Backend HTTP `/api/v1` only | Prisma, filesystem storage, `BLOCKCHAIN_PRIVATE_KEY`, ethers writes, authoritative MATCH/MISMATCH |
| `backend/` | Agent 2 (orchestration), with Agents 3/5/6 inside | Prisma, storage port, `BlockchainService`, CRB/NeST adapters | Put files on-chain; treat mock CRB/NeST as live |
| `backend/prisma/` | Agent 3 | — | Invent a second database |
| `contracts/` | Agent 4 | Hardhat local / configured RPC | Store documents or PII |
| `backend/src/services/storage/`, hash, verification | Agent 5 | Storage port, Prisma via repositories | Bypass auth; hash in the frontend as authority |
| `backend` auth/RBAC | Agent 6 | JWT, Argon2id, `authorize`, `assertCanAttest` | A second auth system |
| Passport / public verify | Agent 7 | Backend read models + public verify API | Persist a Passport table without a new ADR |
| Tests | Agent 8 | All packages | Weaken production authorization to make tests pass |
| Security | Agent 9 | Review all packages | Rewrite features instead of reviewing |

## Backend internal layers

Keep the existing folders. Do not invent a parallel tree.

| Folder | Responsibility | Owner |
| --- | --- | --- |
| `backend/src/routes/` | Path wiring only | Agent 2 |
| `backend/src/controllers/` | HTTP mapping, envelope, status codes | Agent 2 |
| `backend/src/services/` | Domain rules | Agent 2 + domain agents |
| `backend/src/repositories/` | Prisma access | Agent 3 |
| `backend/src/middleware/` | Authn, authz, errors | Agent 6 + Agent 2 |
| `backend/src/blockchain/` | ethers adapter | Agent 4 |
| `backend/src/integrations/` | CRB / NeST ports | Agent 2 (keep mocks labeled) |
| `backend/src/services/storage/` | File port | Agent 5 |
| `backend/src/utils/hash.ts` | SHA-256 | Agent 5 |

## Authoritative data ownership

| Data | Authority | Copies allowed |
| --- | --- | --- |
| Users, roles, passwords | PostgreSQL `User` | JWT claims are a cache; `GET /auth/me` reloads from DB |
| Contractor, Project, Milestone | PostgreSQL | Frontend display only |
| Evidence metadata | PostgreSQL `Evidence` | — |
| File bytes | `StorageService` via `storageReference` | Never on-chain; never in frontend local disk APIs |
| SHA-256 | `EvidenceVersion.sha256` | `Evidence.sha256` is denormalized current hash; `BlockchainEvent.evidenceHash` is the same hex copied for the proven version |
| Verification result | Backend verification service | Frontend renders the result; must not invent MATCH |
| Attestation | PostgreSQL `Attestation` after `assertCanAttest` | — |
| Policy | PostgreSQL `VerificationPolicy` | — |
| Proof | Chain transaction + `BlockchainEvent` row written by backend | Frontend shows tx hash |
| Passport | Derived read model | Optional cache later only via new ADR |
| CRB / NeST | Adapter result with `source: "SYNTHETIC_DEMO"` until a live adapter ADR | May be copied onto Contractor/Project fields only when labeled synthetic |

## Frontend must never

- Open PostgreSQL or Prisma
- Hold `BLOCKCHAIN_PRIVATE_KEY` or submit chain transactions
- Read `STORAGE_PATH` or evidence files except through authorized API download
- Decide authoritative MATCH / MISMATCH / VERIFIED
- Treat hidden navigation as authorization
- Call Hardhat or ethers

## Blockchain must never

- Store evidence bytes, passwords, national IDs, phone numbers, addresses, or private contract terms
- Be called from the browser
- Be treated as the application source of truth for lists, search, or RBAC

## Existing components that stay canonical

| Topic | Canonical location | Discard / do not revive |
| --- | --- | --- |
| HTTP client | `frontend/src/services/api/client.ts` | Empty `frontend/src/api/` |
| API origin env | `VITE_API_ORIGIN` | Documented `VITE_API_BASE_URL` |
| Auth | JWT + Argon2id already in backend | Do not add session cookies as a second system |
| Storage | `StorageService` / `LocalFilesystemStorageService` | Do not add a second upload path |
| Hash | `backend/src/utils/hash.ts` | Do not hash authoritatively in the browser |
| Chain adapter | `backend/src/blockchain/BlockchainService.ts` | Do not add a frontend adapter |
| Attest gate | `assertCanAttest` | Do not write a second contractor check |

## Route stub alignment

Existing 501 stubs remain until the owning agent implements them. Canonical resource families are listed in `docs/api/api-overview.md`. The current stub `/api/v1/verifications` (plural) is replaced by `/api/v1/verification` when Agent 2 implements — do not keep both as live APIs.
