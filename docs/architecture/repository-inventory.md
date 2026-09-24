# ContractorProof Blockchain — Repository Inventory

Inspection date: 2026-09-24  
Scope: actual files in `/home/egovridc26/Desktop/ContractorProof`  
Method: file inspection only. No application source was modified. No dependencies were installed. Existing tests and `prisma validate` / backend `tsc` were run because `node_modules` already existed.

This document is a factual inventory snapshot (2026-09-24). It does not override the architecture freeze.

**Authoritative decisions:** [system-overview.md](system-overview.md), [integration-rules.md](integration-rules.md), and `docs/architecture/adr/`. Inventory “open questions” that those documents answer are closed.

---

## 1. Repository Overview

ContractorProof is a Phase 1 scaffold for an evidence-verification and provenance layer. The repository is a three-package npm tree (not an npm/pnpm workspace), plus documentation and a PostgreSQL Compose file.

| Area | Status |
| --- | --- |
| Frontend shell, login, RBAC navigation | Present and working as UI |
| Backend health + JWT auth + synthetic CRB/NeST lookups | Present and working |
| Prisma domain schema | Present |
| Domain HTTP APIs (projects, evidence, attestations, verification, passports, etc.) | Route stubs only; return `501` |
| Evidence upload / SHA-256 lifecycle | Utilities exist; lifecycle is not implemented |
| Public MATCH/MISMATCH verification | Not implemented |
| Performance Passport entity | Missing as a data model |
| Smart contract + Hardhat tests | Present |
| Backend blockchain adapter | Present; unused by routes |
| CI/CD, app Dockerfiles, shared types package | Missing |

README.md accurately describes this as a scaffold. Domain APIs beyond auth, health, and synthetic integration lookups are structured but not implemented.

There are no git commits yet (`master` has no commits). `.env` files exist locally and are gitignored.

---

## 2. Directory Structure

### Root folders that exist

```
ContractorProof/
  backend/
  contracts/
  docs/
  frontend/
  docker-compose.yml
  package.json
  README.md
  .env.example
  .gitignore
```

### Classification

| Category | Actual location | Notes |
| --- | --- | --- |
| Frontend | `frontend/` | React + Vite app |
| Backend | `backend/` | Express API |
| Database | `backend/prisma/` | Schema + one init migration |
| Blockchain | `contracts/` | Hardhat + one Solidity contract |
| Evidence/storage | `backend/storage/` | Empty except `.gitkeep`; gitignored contents |
| Authentication | `backend/src/{routes,controllers,services,middleware,utils}` and `frontend/src/features/auth` | Split across backend and frontend |
| Testing | `backend/test/`, `frontend/src/tests/`, `contracts/test/` | No E2E or security tests |
| Documentation | `docs/` | Spec, architecture, API, development, frontend API requirements |
| Deployment/configuration | `docker-compose.yml`, `.env.example`, package scripts | PostgreSQL only |
| Docker files | `docker-compose.yml` only | No `Dockerfile` |
| CI/CD | Missing | No `.github/`, `.gitlab-ci.yml`, or CircleCI |
| Scripts | `contracts/scripts/deploy.ts` only | No root `scripts/` |
| Shared packages/types | Missing | Roles/types are duplicated in frontend and backend |
| Infrastructure | Missing | No Terraform/Bicep/K8s |

### Large generated / dependency folders (contents not dumped)

These exist and were not inventoried:

- `frontend/node_modules/`
- `frontend/dist/`
- `backend/node_modules/`
- `backend/dist/`
- `contracts/node_modules/`
- `contracts/artifacts/`
- `contracts/cache/`
- `contracts/typechain-types/`

### Empty leftover folder

- `frontend/src/api/` exists and is empty. The live API client is `frontend/src/services/api/`. `docs/ARCHITECTURE.md` still refers to `src/api/client.ts`.

### Missing folders (explicit)

- `docs/architecture/` did not exist before this inventory report
- `.github/`
- root `scripts/`
- `packages/` or other shared library
- `e2e/`
- `infra/`
- MinIO / object-storage implementation folder
- backend evidence/project/milestone/verification services (files do not exist)

---

## 3. Actual Technology Stack

Determined from package manifests and source, not from assumptions.

### Frontend

| Concern | Actual |
| --- | --- |
| Framework | React 18.3 |
| Language | TypeScript 5.9 |
| Build tool | Vite 6.3 (`@vitejs/plugin-react`) |
| CSS | Tailwind CSS 3.4, PostCSS, Autoprefixer |
| UI libraries | Local components only (`Button`, `Card`, `StatusBadge`, `PageHeader`). No MUI/Chakra/Radix. |
| State management | React Context (`AuthContext`). No Redux, Zustand, or React Query. |
| Routing | `react-router-dom` 6.30 |
| API client | Custom `fetch` wrapper in `frontend/src/services/api/client.ts` |
| Testing | Vitest 3.2, Testing Library, jsdom, user-event |
| Lint | ESLint 9 + typescript-eslint + react-hooks |

### Backend

| Concern | Actual |
| --- | --- |
| Runtime | Node.js (docs say 20+; no `engines` field in package.json) |
| Language | TypeScript 5.9, compiled CommonJS to `dist/` |
| Framework | Express 4.21 |
| Middleware | `cors`, `express.json` (2mb), custom `authenticate`, `authorize`, `errorHandler` |
| Validation | Manual checks in `auth.service.ts`. No Zod/Joi/Yup. |
| Authentication | JWT (`jsonwebtoken`), Argon2id (`argon2`) |
| API documentation | Markdown only (`docs/API.md`). No OpenAPI/Swagger. |
| Testing | Vitest 3.2 + Supertest. One health file. |
| ORM | Prisma 6 |
| Blockchain client | `ethers` 6.15 |

### Database

| Concern | Actual |
| --- | --- |
| Engine | PostgreSQL 16 Alpine (`docker-compose.yml`) |
| Host port | `5433` → container `5432` |
| ORM | Prisma |
| Migration tool | Prisma Migrate |
| Schema | `backend/prisma/schema.prisma` |
| Init migration | `backend/prisma/migrations/20260924120000_init/migration.sql` |

### Blockchain

| Concern | Actual |
| --- | --- |
| Solidity | `^0.8.24` in contract; Hardhat compiles `0.8.24` |
| Toolchain | Hardhat 2.22 + `@nomicfoundation/hardhat-toolbox` |
| Library | ethers v6 (Hardhat plugin + backend) |
| Contracts | `ContractorProofRegistry` only |
| Deployment | `contracts/scripts/deploy.ts` |
| Networks | `hardhat` (in-process) and `localhost` (`RPC_URL` or `http://127.0.0.1:8545`) |
| Tests | Mocha/Chai via Hardhat (`contracts/test/ContractorProofRegistry.ts`) |
| Foundry | Missing (`foundry.toml` does not exist) |

### Storage

| Concern | Actual |
| --- | --- |
| Mechanism | Local filesystem under `STORAGE_PATH` (default `backend/storage`) |
| Interface | `StorageService` + `LocalFilesystemStorageService` |
| Upload handling | Missing. No multer/busboy. Evidence POST returns 501. |
| File processing | Missing. SHA-256 helper exists but is unused. |
| Object storage | Not implemented. Comments mention MinIO later. |

### DevOps

| Concern | Actual |
| --- | --- |
| Docker | Compose for PostgreSQL only. No application Dockerfile. |
| CI/CD | Missing |
| Environment | Root `.env.example`, `frontend/.env.example`, local `backend/.env` and `frontend/.env` (gitignored) |

---

## 4. Frontend

Location: `frontend/`

### Entry, routing, layouts

| Item | File | Purpose |
| --- | --- | --- |
| HTML shell | `frontend/index.html` | Mounts `#root`, loads Google fonts |
| Entry | `frontend/src/main.tsx` | React 18 createRoot |
| App | `frontend/src/app/App.tsx` | BrowserRouter + providers + router |
| Providers | `frontend/src/app/providers/AppProviders.tsx` | AuthProvider only |
| Router | `frontend/src/app/router.tsx` | All routes |
| App layout | `frontend/src/components/layout/AppShell.tsx` | Sidebar + header + outlet |
| Public layout | `frontend/src/components/layout/PublicLayout.tsx` | Login / verify / unauthorized |

### Pages

| Route | Page | Status |
| --- | --- | --- |
| `/login` | `LoginPage.tsx` | Implemented (login + register form) |
| `/verify` | `PublicVerificationPage.tsx` | Placeholder explanation only |
| `/public/verify` | Redirect to `/verify` | Implemented redirect |
| `/unauthorized` | `UnauthorizedPage.tsx` | Implemented |
| `/dashboard` | `DashboardPage.tsx` | Health check + empty cards |
| `/forbidden` | `ForbiddenPage.tsx` | Implemented |
| `/contractors` | `PlaceholderPage` | Placeholder |
| `/projects` | `PlaceholderPage` | Placeholder |
| `/projects/:projectId` | `PlaceholderPage` | Placeholder |
| `/milestones` | `PlaceholderPage` | Placeholder |
| `/evidence` | `PlaceholderPage` | Placeholder |
| `/verification` | `PlaceholderPage` | Placeholder; **no RoleGate** |
| `/passports` | `PlaceholderPage` | Placeholder |
| `/disputes` | `PlaceholderPage` | Placeholder |
| `/corrections` | `PlaceholderPage` | Placeholder |
| `/variations` | `PlaceholderPage` | Placeholder |
| `/audit` | `PlaceholderPage` behind `RoleGate` | Placeholder; gated to AUDITOR, ADMIN, PROCUREMENT_OFFICER |
| `/settings` | `PlaceholderPage` | Placeholder |
| `*` | Navigate to `/dashboard` | Catch-all |

### Authentication handling

- `AuthContext` restores session via `GET /auth/me` if `localStorage` has `contractorproof_token`.
- `ProtectedRoute` redirects unauthenticated users to `/unauthorized`.
- `GuestRoute` sends authenticated users from `/login` to `/dashboard`.
- `RoleGate` is used only on `/audit`.
- Logout clears the token and navigates to `/login`.

### API client and state

- Single client: `frontend/src/services/api/client.ts` (`VITE_API_ORIGIN` + `/api/v1`).
- Auth API: `frontend/src/services/api/auth.ts` (`login`, `register`, `me`).
- Health: `getHealth()` calls `{origin}/health` (not versioned).
- No other API modules. Dashboard does not call contractors/projects/evidence.
- Session: `frontend/src/utils/session.ts` (localStorage).
- No global domain store.

### Forms

- Login/register form only (`LoginPage.tsx`).
- Evidence upload UI: **missing**.
- Contractor / project / milestone / verification / passport forms: **missing**.

### Error / loading states

Present as reusable components:

- `LoadingState`, `ErrorState`, `EmptyState`
- Dashboard uses all three for API health only

### Frontend business logic that belongs on the backend

The frontend does **not** compute hashes, attestations, or blockchain proofs. Remaining frontend-only policy:

1. Nav hiding for Verification (non-contractor roles) and Audit (auditor/admin/procurement). Hiding is not authorization.
2. `/verification` is reachable by URL for a contractor because it has no `RoleGate`.
3. Public registration UI lets the user pick any role except `ADMIN`, matching the backend allow-list.
4. Catch-all `*` sends unknown paths to `/dashboard` (then `/unauthorized` if logged out). Public unknown URLs are not a dedicated 404.

### Important frontend files

See section 23 for the full inspected list.

---

## 5. Backend

Location: `backend/`

### Entry and composition

| Item | File |
| --- | --- |
| Process entry | `backend/src/server.ts` — listens on `env.port`; Prisma disconnect only on startup failure |
| App | `backend/src/app.ts` — CORS, JSON 2mb, `/health`, `/api/v1`, error handler |
| Router | `backend/src/routes/index.ts` |
| Config | `backend/src/config/env.ts` |

### Layers that exist

| Layer | What exists |
| --- | --- |
| Routes | All domain path prefixes exist |
| Controllers | `auth`, `health`, `integrations` only |
| Services | `auth.service`, `audit.service`, `attestation.service` (`assertCanAttest` only), storage port |
| Repositories | `prisma.ts`, `user.repository.ts` only |
| Middleware | `authenticate`, `authorize`, `errorHandler`, `notImplemented` |
| Blockchain | `BlockchainService.ts` (unused by routes) |
| Integrations | CRB/NeST interfaces + mock adapters |

### Missing backend layers

- Controllers/services/repositories for contractors, projects, milestones, evidence, verifications, attestations, disputes, corrections, variations, passports, blockchain events
- File-upload middleware
- Structured logging
- Rate limiting
- Security headers
- Schema validation library
- API versioning beyond the `/api/v1` prefix
- Audit HTTP route (service exists; no `/audit` router)

### Authentication / authorization (backend)

- JWT Bearer required on all domain routers except health, auth register/login, and public verify.
- `authorize(...)` is used only on `/api/v1/blockchain` (`ADMIN`, `AUDITOR`).
- Other authenticated 501 routes have **no role checks**.
- `assertCanAttest` is **not imported by any route**.

### Error handling and logging

- `HttpError` → `{ error: message }` with status.
- Unknown errors → 500 with `err.message` (can leak internals).
- No logger. `server.ts` uses `console.log` / `console.error`.

### Database connection

- `PrismaClient` singleton in `backend/src/repositories/prisma.ts`.
- No health check against the database.
- Server starts even if PostgreSQL is down (first Prisma call would fail).

### Blockchain / evidence integration

- Adapter exists; routes do not call it.
- Evidence routes do not call storage or SHA-256.

---

## 6. Database

Schema: `backend/prisma/schema.prisma`  
Migration: `backend/prisma/migrations/20260924120000_init/migration.sql`  
Lock: `backend/prisma/migrations/migration_lock.toml` (`provider = "postgresql"`)

Prisma validate: **passed**.

### Entities that exist

See section 17 for field-level detail.

Present models: `User`, `Contractor`, `Project`, `VerificationPolicy`, `Milestone`, `Evidence`, `Attestation`, `BlockchainEvent`, `Dispute`, `Correction`, `ContractVariation`, `AuditLog`.

### Entities that do not exist

| Expected by spec/UI | Database |
| --- | --- |
| Passport / Performance Passport | **Missing** |
| Evidence version | **Missing** (no version column or table) |
| Standalone Proof table | **Missing** (proof is `BlockchainEvent.txHash` / `evidenceHash`) |
| External reference table | **Missing** (CRB/NeST fields live on Contractor/Project) |
| Role table | **Missing** (Prisma `Role` enum on `User`) |
| Permissions table | **Missing** |

### Duplicate / conflicting representations

- Frontend `EvidenceStatus` (`MATCH`, `MISMATCH`, `PENDING`, `UNAVAILABLE`, `VERIFIED`, `REJECTED`, `DISPUTED`) is not the same as Prisma `EvidenceStatus` (`PENDING_VERIFICATION`, `VERIFIED`, `REJECTED`).
- Hash stored as `Evidence.sha256` (hex string) and separately as `BlockchainEvent.evidenceHash`.
- No Passport row; UI and routes use “passports” as if it were an entity.
- Contractor is both a `User.role` and a `Contractor` profile (1:1 on `userId`).

### Mutability note

`Evidence`, `Milestone`, `Dispute`, `Contractor`, `Project` have `updatedAt`. The schema does not enforce append-only history for those tables. Append-only intent is expressed for events (`BlockchainEvent.previousEventId`, Correction/Variation linking). Nothing in application code currently writes those tables except `User`, `Contractor` (on contractor register), and `AuditLog`.

---

## 7. Blockchain

### Contract

- File: `contracts/contracts/ContractorProofRegistry.sol`
- Name: `ContractorProofRegistry`
- License: MIT
- Solidity: `^0.8.24`

**Storage**

- `owner` (address)
- `recorders` (address → bool)
- `projectExists` (bytes32 → bool)
- `eventExists` (bytes32 → bool)

**Functions**

- `constructor` — sets owner and authorizes owner as recorder
- `setRecorder(address, bool)` — owner only
- `registerProject(bytes32 projectId, bytes32 contractorId)`
- `recordVerification(bytes32 eventId, bytes32 projectId, bytes32 milestoneId, bytes32 evidenceHash, bytes32 actorId)`
- `recordAttestation(bytes32 eventId, bytes32 projectId, bytes32 evidenceHash, bytes32 actorId, bool approved)`
- `recordCorrection(bytes32 eventId, bytes32 previousEventId, bytes32 evidenceHash, bytes32 actorId)`
- `recordDispute(bytes32 eventId, bytes32 previousEventId, bytes32 actorId)`
- `recordResolution(bytes32 eventId, bytes32 disputeEventId, bytes32 actorId)`
- `recordVariation(bytes32 eventId, bytes32 previousEventId, bytes32 variationRef, bytes32 actorId)`

**Events**

- `RecorderUpdated`, `ProjectRegistered`, `VerificationRecorded`, `AttestationRecorded`, `CorrectionRecorded`, `DisputeRecorded`, `ResolutionRecorded`, `VariationRecorded`

On-chain data is identifiers and hashes (`bytes32`) plus timestamps. The contract does **not** store documents, PII, or file bytes.

Events cannot be overwritten: `_markNewEvent` reverts on `event already recorded`. Projects cannot be re-registered.

### Deployment and networks

- Script: `contracts/scripts/deploy.ts` — deploys and prints address for `CONTRACT_ADDRESS`
- Networks: Hardhat local + `localhost` using `RPC_URL` / optional `BLOCKCHAIN_PRIVATE_KEY`
- ABI generation: Hardhat artifacts + TypeChain (`contracts/typechain-types/` exists from a prior compile)

### Backend adapter

`backend/src/blockchain/BlockchainService.ts`

- Uses a **hand-written ABI string**, not the generated TypeChain factory
- Read contract: provider only
- Write contract: `Wallet(env.blockchainPrivateKey)`
- `isConfigured()` is true only if `CONTRACT_ADDRESS` is set
- **Not imported by any route or service other than its own file**

### Frontend blockchain access

**None.** Frontend has no `ethers` dependency and no contract calls.

### Private keys

Intended to be server-side via `BLOCKCHAIN_PRIVATE_KEY`. Frontend does not contain a blockchain key. Root `.env.example` leaves the key empty. Hardhat falls back to default local accounts when the key is empty.

### Incorrect on-chain document storage

Not present. The contract stores hashes and IDs only.

---

## 8. Evidence Lifecycle

Specified path: UPLOAD → VALIDATION → STORAGE → HASHING → DATABASE RECORD → POLICY → ATTESTATION → BLOCKCHAIN PROOF → VERIFICATION

### Actual implementation per stage

| Stage | Implemented? | File |
| --- | --- | --- |
| UPLOAD | **No** | `backend/src/routes/evidence.routes.ts` POST `/` → 501. No multipart parser. |
| VALIDATION | **No** | No MIME/size/type checks. JSON body limit is 2mb on the app, not file-aware. |
| STORAGE | Port only | `StorageService.ts`, `LocalFilesystemStorageService.ts`. Unused by routes. |
| HASHING | Utility only | `backend/src/utils/hash.ts` — `sha256Buffer`, `sha256Hex`. Unused by routes. |
| DATABASE RECORD | Schema only | `Evidence` model. No repository/service writes it. |
| POLICY | Schema only | `VerificationPolicy`. No evaluation code. |
| ATTESTATION | Helper only | `assertCanAttest` in `attestation.service.ts`. Routes return 501. |
| BLOCKCHAIN PROOF | Adapter + contract | `BlockchainService` unused; contract tests use synthetic UTF-8 hash. |
| VERIFICATION | **No** | `verifications.routes.ts` GET `/` → 501. Public POST verify → 501. |

### Hashing details

- Algorithm in utility: **SHA-256** via Node `crypto.createHash("sha256")`.
- Digest format: hex string.
- When hashing happens: **never in the running API**.
- Contract tests hash `ethers.sha256(ethers.toUtf8Bytes("synthetic-evidence"))` — SHA-256 of a string, not of an uploaded file.

### Storage behavior (if/when used)

- Save: UUID + original file extension under `STORAGE_PATH`.
- Read: `path.basename(storageKey)` before join (blocks `../` traversal on read).
- Save path joins `storageKey` directly after generating it (safe because key is UUID-generated).
- No overwrite API. A new save always creates a new UUID key.
- Directory `backend/storage/` is gitignored except `.gitkeep`.

### Versions, overwrite, tamper detection

- Evidence versions: **not represented**.
- Unique constraint: `(milestoneId, sha256)` — same hash cannot be stored twice on the same milestone.
- Overwrite of historical evidence records: not implemented; schema has `updatedAt` so a future writer could mutate metadata.
- Tamper detection: **not implemented**.
- Verification hash compare: **not implemented**.

---

## 9. Authentication and RBAC

### Login mechanism

- `POST /api/v1/auth/register` — public
- `POST /api/v1/auth/login` — public
- `GET /api/v1/auth/me` — JWT

Passwords: Argon2id (`backend/src/utils/password.ts`).  
Tokens: JWT signed with `JWT_SECRET`, payload `{ sub, email, role }`, expiry **12h**.  
Refresh tokens: **missing**.  
Frontend storage: `localStorage` key `contractorproof_token`.

### Roles (actual enum)

`CONTRACTOR`, `CLIENT`, `CONSULTANT_ENGINEER`, `PROCUREMENT_OFFICER`, `AUDITOR`, `ADMIN`

Public registration allows every role except `ADMIN` (`PUBLIC_REGISTER_ROLES` in `backend/src/types/index.ts`). Registering as `CONTRACTOR` also creates a `Contractor` row with `legalName = fullName` and `crbSource = "SYNTHETIC_DEMO"`.

### Permissions / ownership

- No permission table.
- `authorize(...roles)` exists; used only on blockchain list route.
- Resource ownership checks: **missing** (no project/evidence services).
- `assertCanAttest`:
  - any `CONTRACTOR` role → 403 “a contractor cannot verify or attest evidence”
  - actor is uploader → 403
  - actor is contractor owner (`contractorUserId`) → 403
- This helper is **not wired**. Attestation API is 501.

### Can a contractor verify their own evidence?

**Current actual behavior:**

1. **API:** `POST /api/v1/attestations` and `GET /api/v1/verifications` require a JWT but return **501**. No attestation can succeed for any role.
2. **Intended rule in unused code:** contractors cannot attest at all; uploaders cannot attest their upload.
3. **Frontend:** Verification is hidden from the contractor nav. The `/verification` route is **not** role-gated, so a contractor who types the URL sees the same placeholder as others. No attest action exists.

Conclusion: contractors cannot currently verify anyone’s evidence because verification is unimplemented. The self-verification prohibition exists only as an unused function.

### Protected routes

Backend: all listed domain routers use `authenticate` except health, auth register/login, and `/api/v1/public/*`.  
Frontend: AppShell routes use `ProtectedRoute`. `/audit` additionally uses `RoleGate`.

---

## 10. Public Verification

| Surface | Status |
| --- | --- |
| `GET /api/v1/public/verify` | Implemented scaffold JSON. No auth. Explains future POST and MATCH meaning. |
| `POST /api/v1/public/verify` | 501 `notImplemented("public/verify")` |
| Page `/verify` | Placeholder. States that hashing and MATCH/MISMATCH are not calculated. |
| Page `/public/verify` | Redirects to `/verify` |
| QR verification | **Missing** |
| Passport generation | **Missing** (route 501; no model) |
| Proof lookup | **Missing** |
| MATCH/MISMATCH | UI badge types exist; no comparison logic |

### Information exposed publicly

`GET /api/v1/public/verify` returns:

```json
{
  "status": "scaffold",
  "usage": "POST /api/v1/public/verify with an evidence file in a later phase",
  "matchMeaning": "MATCH means the submitted file matches the recorded evidence fingerprint. It does not mean the blockchain independently proves the underlying claim is true."
}
```

No evidence records, emails, or hashes are exposed. Sensitive leakage via public verify is **not present** because the feature is unimplemented.

---

## 11. External Integrations

| Integration | Status | Evidence |
| --- | --- | --- |
| CRB | **MOCK** | `MockCrbIntegrationAdapter` with `CRB-DEMO-001` / `CRB-DEMO-002`. Responses labeled `source: "SYNTHETIC_DEMO"`. Controller adds a notice that no live CRB API was called. |
| NeST | **MOCK** | `MockNestIntegrationAdapter` with `NEST-DEMO-100`. Same synthetic labeling. |
| Payment systems | **NOT IMPLEMENTED** | No files |
| Identity providers | **NOT IMPLEMENTED** | Local email/password only |
| Email | **NOT IMPLEMENTED** | No files |
| Cloud storage | **PLACEHOLDER** | Interface only; local filesystem class |
| Blockchain RPC | **REAL client, unused** | ethers `JsonRpcProvider(env.rpcUrl)`. No live calls from API routes. |
| PPRA | **NOT IMPLEMENTED** | Mentioned in spec as out of scope |
| MinIO | **NOT IMPLEMENTED** | Mentioned in comments/docs only |

CRB/NeST lookups require JWT. They do not persist results onto Contractor/Project records.

---

## 12. Testing

### What exists

| Kind | Location | What it covers |
| --- | --- | --- |
| Backend API | `backend/test/health.test.ts` | `GET /health` and `GET /api/v1/health` |
| Frontend unit/component | `frontend/src/tests/*.test.tsx` | Login form render, logout, nav role visibility, forbidden audit, unauthorized, protected route |
| Blockchain | `contracts/test/ContractorProofRegistry.ts` | Project register, unauthorized recorder, event recording, no overwrite of event id |

### What is missing

- Backend auth tests
- Integration tests against PostgreSQL
- Evidence / SHA-256 / attestation / passport API tests
- Frontend tests for public verification or domain pages
- E2E tests
- Security tests
- Tamper / MATCH-MISMATCH tests

### Golden path

User → Login → Contractor → Project → Milestone → Evidence → SHA-256 → Attestation → Blockchain Proof → Verification → MATCH → Public Verification

**Not tested.** Most steps have no implementation.

### Tamper path

Original file → HASH_A → Proof; modified file → HASH_B; HASH_A != HASH_B → MISMATCH

**Not tested.** Contract test hashes a constant string, not two file versions.

### Commands run during this inspection (existing installs only)

| Command | Result |
| --- | --- |
| `backend && npm test` | 2 passed |
| `frontend && npm test` | 7 passed (React Router v7 future-flag warnings on stderr) |
| `contracts && npm test` | 4 passed |
| `backend && npx prisma validate` | Schema valid |
| `backend && npm run build` | Prisma generate + `tsc` succeeded |

---

## 13. Configuration

### Package / config files

| File | Purpose | Important scripts / deps |
| --- | --- | --- |
| `/package.json` | Root convenience scripts only. Not a workspace. | `dev:backend`, `dev:frontend`, `dev:chain`, `build:*`, `test:contracts`, `db:up`, `db:down` |
| `backend/package.json` | API package | `dev` (tsx watch), `build` (prisma generate + tsc), `start`, `test`, prisma scripts. Deps: express, prisma, argon2, cors, dotenv, ethers, jsonwebtoken |
| `frontend/package.json` | UI package | `dev`, `build`, `preview`, `lint`, `test`. Deps: react, react-dom, react-router-dom |
| `contracts/package.json` | Chain package | `compile`, `test`, `node`, `deploy:local`. Hardhat + ethers + chai |
| `backend/package-lock.json` | npm lock | Present; not copied |
| `frontend/package-lock.json` | npm lock | Present; not copied |
| `contracts/package-lock.json` | npm lock | Present; not copied |
| `pnpm-lock.yaml` | Missing | — |
| `yarn.lock` | Missing | — |
| `Cargo.toml` / `requirements.txt` / `pyproject.toml` / `composer.json` / `go.mod` | Missing | — |
| `contracts/hardhat.config.ts` | Solidity 0.8.24, hardhat + localhost | Loads `BLOCKCHAIN_PRIVATE_KEY`, `RPC_URL` |
| `foundry.toml` | Missing | — |
| `docker-compose.yml` | PostgreSQL 16 | User/db `contractorproof`, host port 5433 |
| `Dockerfile*` | Missing | — |
| `backend/tsconfig.json` | CommonJS, `src` → `dist` | Tests excluded from compile |
| `backend/vitest.config.ts` | Node env, `test/**/*.test.ts` | — |
| `frontend/tsconfig.json` | Project references | — |
| `frontend/tsconfig.app.json` | App TS (excludes tests) | — |
| `frontend/tsconfig.node.json` | Vite config TS | — |
| `frontend/vite.config.ts` | React plugin, port 5173, Vitest jsdom | — |
| `frontend/tailwind.config.js` | Content paths, Source Serif/Sans | — |
| `frontend/postcss.config.js` | tailwind + autoprefixer | — |
| `frontend/eslint.config.js` | ESLint 9 flat config | — |
| `backend/prisma/schema.prisma` | Data model | — |

### Environment variable names (values not recorded)

From `.env.example` and code:

- `DATABASE_URL`
- `PORT`
- `JWT_SECRET`
- `FRONTEND_URL`
- `STORAGE_PATH`
- `RPC_URL`
- `BLOCKCHAIN_PRIVATE_KEY`
- `CONTRACT_ADDRESS`
- `NODE_ENV` (read in `env.ts`, not in `.env.example`)
- `VITE_API_ORIGIN` (frontend)

`.env` existence:

- Root `.env`: **missing**
- Root `.env.example`: **present**
- `backend/.env`: **present locally**, gitignored
- `frontend/.env`: **present locally**, gitignored
- `frontend/.env.example`: **present**
- `contracts/.env`: **missing**
- `.env` files are **not** committed (`.gitignore` lists them; `git check-ignore` confirms)

### Run commands (do not install)

Frontend dev: `cd frontend && npm run dev`  
Backend dev: `cd backend && npm run dev` (expects `backend/.env` and Postgres)  
Frontend tests: `cd frontend && npm test`  
Backend tests: `cd backend && npm test`  
Frontend build: `cd frontend && npm run build`  
Backend build: `cd backend && npm run build`  
Migrations: `cd backend && npm run prisma:migrate` (or `npx prisma migrate dev`)  
Blockchain tests: `cd contracts && npm test`  
Local chain: `cd contracts && npm run node`  
Deploy local: `cd contracts && npm run deploy:local`  
Postgres: `docker compose up -d` from repo root

---

## 14. Security Observations

No secret values are reproduced here.

### Hardcoded / default secrets

- Potential hardcoded secret found at `backend/src/config/env.ts:21` — `JWT_SECRET` falls back to a built-in development string if unset.
- `backend/src/config/env.ts` also falls back `DATABASE_URL` to the local Compose credentials if unset.
- `docker-compose.yml` and `.env.example` contain the local PostgreSQL username/password `contractorproof`. These are documented local defaults, not production key material.
- No blockchain private key was found in frontend source.
- No `0x` + 64-hex private key was found in application source.

### Controls that exist

- CORS origin restricted to `FRONTEND_URL`
- JWT required on domain routes
- Argon2id password hashing
- Prisma parameterized queries (SQL injection via raw SQL not present)
- `path.basename` on storage reads
- `ADMIN` cannot self-register
- `.env` gitignored
- JSON body limit 2mb

### Controls that are missing

- Rate limiting
- Helmet / security headers
- Refresh-token rotation
- Input validation library
- File upload limits and MIME allow-list (upload not implemented)
- Role checks on most authenticated routes
- Database-backed health
- Structured audit of failed logins (failed login does not write AuditLog)
- Public self-assignment of privileged roles (`AUDITOR`, `CONSULTANT_ENGINEER`, `PROCUREMENT_OFFICER`)

### Other

- 500 responses may include internal `Error.message`
- Access token in `localStorage` (XSS would expose it)
- Storage files are local and not access-controlled by an HTTP download route (no download route exists)

---

## 15. Domain Terminology

| Concept | Names actually used | Inconsistency |
| --- | --- | --- |
| Contractor | `Contractor` model; `Role.CONTRACTOR`; UI “Contractors”; `legalName` | User `fullName` copied to `legalName` on register. No `vendor` / `company` type. |
| Project | `Project` | Consistent |
| Milestone | `Milestone`; route nest ` /projects/:projectId/milestones`; UI `/milestones` | Frontend has a top-level milestones page; API does not have `/milestones` |
| Evidence | `Evidence`; UI “Evidence” | Frontend status union mixes evidence and verification outcomes |
| Evidence Hash | `Evidence.sha256`; `BlockchainEvent.evidenceHash`; Solidity `evidenceHash` | Three names; SHA-256 hex vs bytes32 not converted in code |
| Policy | `VerificationPolicy`; field `policy` on Milestone | Docs also say “Verification Policy”. No type named `Policy`. |
| Attestation | `Attestation`; `AttestationDecision` | Separate from `verifications` routes |
| Proof | No `Proof` type. Closest: `BlockchainEvent.txHash`, contract events | Docs say “blockchain proofs”; code says `BlockchainEvent` |
| Verification | `verifications` routes; `recordVerification`; `EvidenceStatus`; `MilestoneStatus` | Overlaps attestation. Frontend `/verification` vs API `/verifications` |
| Passport | Routes/pages `passports` / “Performance passports” | **No model**. Spec uses Performance Passport. |
| Dispute | `Dispute`; `DisputeStatus` | Consistent |
| Correction | `Correction` | Consistent |
| Variation | Model `ContractVariation`; routes `variations`; UI “Variations” / “Contract variations” | Three labels |
| External Reference | Fields `crb*`, `nest*`, `ocid` | No `ExternalReference` entity |
| Audit Event | `AuditLog`; UI “Audit trail” | Frontend `/audit`; **no** `/api/v1/audit` |

Additional mismatches:

- Docs `VITE_API_BASE_URL` vs code `VITE_API_ORIGIN`
- Docs `src/api/client.ts` vs code `src/services/api/client.ts`
- Frontend `PENDING` vs backend `PENDING_VERIFICATION`

No invented trust-score or compliance-percentage types exist in code. Dashboard copy explicitly says the product does not calculate a trust score.

---

## 16. Existing API Surface

Base path: `/api/v1` unless noted. JSON bodies.

### Implemented

| METHOD | PATH | PURPOSE | AUTH | ROLE | REQUEST BODY | IMPORTANT RESPONSE | SOURCE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/health` | Liveness | No | — | — | `{ status: "ok", service: "contractorproof-api" }` | `app.ts`, `health.controller.ts` |
| GET | `/api/v1/health` | Same | No | — | — | Same | `health.routes.ts` |
| POST | `/api/v1/auth/register` | Create user; contractor profile if role CONTRACTOR | No | Public roles except ADMIN | `{ email, password, fullName, role }` | 201 `{ token, user }`; 400/409 | `auth.routes.ts`, `auth.controller.ts`, `auth.service.ts` |
| POST | `/api/v1/auth/login` | Sign in | No | — | `{ email, password }` | `{ token, user }`; 401 | same |
| GET | `/api/v1/auth/me` | Current user | JWT | Any authenticated | — | `{ user }` | same |
| GET | `/api/v1/integrations/crb/:registrationNumber` | Synthetic CRB lookup | JWT | Any authenticated | — | `{ notice, source, found, crb* }` | `crb.routes.ts`, `integrations.controller.ts` |
| GET | `/api/v1/integrations/nest/:reference` | Synthetic NeST lookup | JWT | Any authenticated | — | `{ notice, source, found, nest* }` | `nest.routes.ts` |
| GET | `/api/v1/public/verify` | Scaffold explanation | No | — | — | `{ status: "scaffold", usage, matchMeaning }` | `public.routes.ts` |

### Structured 501 stubs

All of the following use `authenticate` (except public POST verify) and return `{ error: "Not implemented in scaffold phase", resource }` with HTTP 501.

| METHOD | PATH | PURPOSE | AUTH | ROLE | BODY | RESPONSE | SOURCE |
| --- | --- | --- | --- | --- | --- | --- | --- |
| GET | `/api/v1/contractors` | List contractors | JWT | none enforced | — | 501 | `contractors.routes.ts` |
| GET | `/api/v1/contractors/:contractorId` | Get contractor | JWT | none | — | 501 | same |
| GET | `/api/v1/projects` | List projects | JWT | none | — | 501 | `projects.routes.ts` |
| GET | `/api/v1/projects/:projectId` | Get project | JWT | none | — | 501 | same |
| GET | `/api/v1/projects/:projectId/milestones` | List milestones | JWT | none | — | 501 | same |
| GET | `/api/v1/evidence` | List evidence | JWT | none | — | 501 | `evidence.routes.ts` |
| POST | `/api/v1/evidence` | Upload evidence | JWT | none | not defined | 501 | same |
| GET | `/api/v1/attestations` | List attestations | JWT | none | — | 501 | `attestations.routes.ts` |
| POST | `/api/v1/attestations` | Create attestation | JWT | none (helper unused) | not defined | 501 | same |
| GET | `/api/v1/verifications` | Verification activity | JWT | none | — | 501 | `verifications.routes.ts` |
| GET | `/api/v1/disputes` | List disputes | JWT | none | — | 501 | `disputes.routes.ts` |
| POST | `/api/v1/disputes` | Create dispute | JWT | none | — | 501 | same |
| GET | `/api/v1/corrections` | List corrections | JWT | none | — | 501 | `corrections.routes.ts` |
| POST | `/api/v1/corrections` | Create correction | JWT | none | — | 501 | same |
| GET | `/api/v1/variations` | List variations | JWT | none | — | 501 | `variations.routes.ts` |
| POST | `/api/v1/variations` | Create variation | JWT | none | — | 501 | same |
| GET | `/api/v1/passports` | List passports | JWT | none | — | 501 | `passports.routes.ts` |
| GET | `/api/v1/passports/:projectId` | Passport by project | JWT | none | — | 501 | same |
| GET | `/api/v1/blockchain` | Blockchain events | JWT | ADMIN, AUDITOR | — | 501 | `blockchain.routes.ts` |
| POST | `/api/v1/public/verify` | Public file verify | No | — | not defined | 501 | `public.routes.ts` |

### Routes documented or UI-expected but missing

| Item | Status |
| --- | --- |
| `GET /api/v1/audit` | Missing (FRONTEND_API_REQUIREMENTS.md lists it) |
| POST contractors / projects / milestones | Missing even as stubs |
| Evidence GET by id / download | Missing |
| Multipart evidence upload | Missing |

---

## 17. Existing Data Model

All PKs are `String` UUID `@default(uuid())` unless noted. Migration matches schema.

### User

- PK: `id`
- Fields: `email` unique, `passwordHash`, `fullName`, `role` (Role enum), timestamps
- Relations: optional `Contractor`; uploaded `Evidence`; `Attestation`; `Dispute`; `Correction`; `ContractVariation`; `AuditLog`; `BlockchainEvent` as actor
- Indexes: unique email
- Migration: init

### Contractor

- PK: `id`
- Fields: `userId` unique, `legalName`, `crbRegistrationNumber`, `crbCategory`, `crbType`, `crbClass`, `crbStatus`, `crbLastVerifiedAt`, `crbSource` default `SYNTHETIC_DEMO`
- Relations: `User` (Restrict), `Project[]`
- Index: `crbRegistrationNumber`
- Created automatically when a CONTRACTOR registers

### Project

- PK: `id`
- Fields: `contractorId`, `name`, `description`, NeST fields (`nestTenderReference`, `nestContractReference`, `ocid`, `procuringEntity`, `contractStatus`, `contractStartDate`, `contractEndDate`), `nestSource` default `SYNTHETIC_DEMO`
- Relations: Contractor, Milestone[], VerificationPolicy[], ContractVariation[], BlockchainEvent[]
- Indexes: contractorId, nestContractReference, ocid

### VerificationPolicy

- PK: `id`
- Fields: optional `projectId`, `name`, `requiredApprovals` default 1, `allowedRoles` Role[], `verifierLabels` Json
- Relations: optional Project (SetNull), Milestone[]
- Comment in schema: labels such as SITE_INSPECTOR map to CONSULTANT_ENGINEER; not extra login roles

### Milestone

- PK: `id`
- Fields: `projectId`, optional `policyId`, `name`, `description`, `status` default PENDING
- Relations: Project, optional Policy (SetNull), Evidence[], Attestation[], Dispute[], Correction[]

### Evidence

- PK: `id`
- Fields: `milestoneId`, `uploadedById`, `fileName`, `storageKey`, `mimeType`, `sizeBytes`, `sha256`, `status` default PENDING_VERIFICATION
- Unique: `(milestoneId, sha256)`
- Indexes: sha256, uploadedById
- No version field

### Attestation

- PK: `id`
- Fields: `milestoneId`, `evidenceId`, `verifierId`, `verifierRole`, `decision`, `comment`, `createdAt` (no updatedAt)
- Unique: `(evidenceId, verifierId)`

### BlockchainEvent

- PK: `id`
- Fields: `projectId`, `eventType`, `referenceId`, `previousEventId`, `txHash`, `blockNumber`, `evidenceHash`, `actorId`, `recordedAt`, `createdAt`
- Self-relation EventChain
- Indexes: projectId, eventType, previousEventId, txHash

### Dispute

- PK: `id`
- Fields: `milestoneId`, `raisedById`, `status` default OPEN, `reason`, optional `originalEventId`, `resolutionEventId`

### Correction

- PK: `id`
- Fields: `milestoneId`, `originalEventId`, `reason`, optional `evidenceId`, `actorId`, `createdAt`

### ContractVariation

- PK: `id`
- Fields: `projectId`, `previousEventId`, `variationReference`, `reason`, optional `evidenceId`, `actorId`
- Unique: `(projectId, variationReference)`

### AuditLog

- PK: `id`
- Fields: optional `userId`, `action`, `entityType`, optional `entityId`, `metadata` Json, `createdAt`
- Written today for `USER_REGISTERED` and `USER_LOGIN` only

### Passport

**Missing.**

---

## 18. Architectural Conflicts

1. **Documentation vs code paths.** Architecture doc points at `src/api/client.ts`; implementation is `src/services/api/client.ts`. Empty `frontend/src/api/` remains. Development doc names `VITE_API_BASE_URL`; code uses `VITE_API_ORIGIN`.
2. **Passport without a model.** Routes, nav, and spec use Performance Passport; Prisma has no Passport.
3. **Verification vs attestation split.** Two HTTP resources plus `assertCanAttest`, plus contract `recordVerification` and `recordAttestation`. No written rule in code for when each is used.
4. **Status vocabularies differ** between frontend `types/status.ts` and Prisma enums.
5. **Frontend RBAC is incomplete vs nav.** Contractor cannot see Verification in the sidebar but can open `/verification`.
6. **Most APIs authenticate but do not authorize.** Only `/blockchain` uses `authorize`.
7. **Self-registration of privileged roles** is allowed (AUDITOR, CONSULTANT_ENGINEER, etc.).
8. **`assertCanAttest` is dead code** relative to HTTP.
9. **BlockchainService is dead code** relative to HTTP; ABI is a subset of the contract (no events, no `setRecorder`, no views).
10. **Storage and SHA-256 are dead code** relative to HTTP.
11. **Audit trail UI has no API.**
12. **No evidence versions** while spec implies historical integrity of files.
13. **`Evidence.updatedAt` vs append-only story** — schema allows later mutation.
14. **Catch-all frontend routing** sends unknown URLs to dashboard/unauthorized rather than a public 404.
15. **Two health URLs**; dashboard uses unversioned `/health`.
16. **No duplicate auth systems.** One JWT path. Not a conflict, but worth stating.
17. **No frontend-direct blockchain or database access.**
18. **No invented trust scores or compliance percentages in code.**
19. **Mock CRB/NeST are labeled synthetic** — not presented as live institutional data in API payloads.
20. **Default JWT secret fallback** if env is missing.

---

## 19. Missing Components

- Domain services/controllers/repositories for the golden path
- Evidence upload (multipart), validation, hashing on write, download
- Evidence versioning
- Verification policy evaluation
- Wired attestation authorization
- Blockchain write/read from API
- Public MATCH/MISMATCH
- Passport model and generation
- QR verification
- Audit HTTP API
- POST APIs for contractors, projects, milestones
- Shared types package
- Validation library
- OpenAPI
- Rate limiting, security headers, logging
- Refresh tokens
- CI/CD
- Application Dockerfiles
- MinIO adapter
- Live CRB/NeST
- Email, payments, IdP
- E2E, tamper, and golden-path tests
- Foundry
- `docs/architecture/` (created only for this report)

---

## 20. Reusable Components

These are real and usable as the integration base:

- Express app skeleton and `/api/v1` router map
- JWT + Argon2id + `authenticate` / `authorize`
- Prisma schema and init migration (except Passport / versions)
- `AuditLog` writer
- `StorageService` port and local filesystem adapter
- SHA-256 helpers
- CRB/NeST adapter interfaces (swap mocks later)
- `BlockchainService` shape and Hardhat contract
- ContractorProofRegistry (hash-only, append-only event ids)
- Frontend AppShell, RoleAwareNav, AuthContext, API client, status badges, empty/error/loading
- Role enums aligned between frontend and Prisma (same six names)
- Compose PostgreSQL
- Existing test harnesses (Vitest, Hardhat)

---

## 21. Recommended Integration Priorities

For Agent 0 planning only. Nothing in this list was implemented during inspection.

1. Freeze official names (especially Passport, Proof vs BlockchainEvent, verification vs attestation, hash field names) and a single status vocabulary.
2. Decide whether Passport is a derived read model or a stored entity; add it if stored.
3. Implement evidence upload → store → SHA-256 → Evidence row → PENDING_VERIFICATION, with versions if history must not mutate.
4. Wire `assertCanAttest` (or a stronger policy evaluator) into attestation routes; keep contractors unable to attest.
5. Implement policy satisfaction → milestone/evidence VERIFIED → `BlockchainService` record + `BlockchainEvent` row.
6. Implement public POST verify: compute SHA-256, compare to stored `Evidence.sha256`, return MATCH/MISMATCH only.
7. Add authorization (role + ownership) to every domain route before UI consumes them; do not treat nav hiding as security.
8. Restrict public registration roles; provision privileged roles out of band.
9. Align frontend API modules with implemented endpoints; remove or document the empty `src/api` folder and env-name drift.
10. Add golden-path and tamper tests before calling verification “done”. Close JWT default-secret and 500-leak issues before any shared environment.

---

## 22. Open Architectural Questions

1. Is a Performance Passport a stored document, a computed projection of `BlockchainEvent` + attestations, or both?
2. How should UUID strings be converted to on-chain `bytes32` project/event/actor IDs?
3. Should `recordVerification` and `recordAttestation` both be emitted, or is one derived from the other?
4. Does public verify require only a file, or a file plus evidence/passport identifier?
5. Are evidence records immutable after insert, or is `updatedAt` allowed for metadata?
6. When should CRB/NeST mock results be copied onto Contractor/Project rows?
7. Should `/verification` and `/attestations` be one resource?
8. What is the download/authorization model for stored files?
9. Will the backend keep a handwritten ABI or switch to TypeChain artifacts?
10. Is local Hardhat the only network for Phase 1, or is a persistent testnet required?
11. Should `SITE_INSPECTOR` / `CLIENT_REPRESENTATIVE` remain labels only?
12. How will ADMIN be created if public registration forbids it?

---

## 23. Files Inspected

### Root

- `README.md`
- `package.json`
- `docker-compose.yml`
- `.env.example` (names only)
- `.gitignore`

### Documentation

- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DEVELOPMENT.md`
- `docs/PROJECT_SPECIFICATION.md`
- `docs/FRONTEND_API_REQUIREMENTS.md`

### Backend

- `backend/package.json`
- `backend/tsconfig.json`
- `backend/vitest.config.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/migration_lock.toml`
- `backend/prisma/migrations/20260924120000_init/migration.sql`
- `backend/src/server.ts`
- `backend/src/app.ts`
- `backend/src/config/env.ts`
- `backend/src/types/index.ts`
- `backend/src/types/express.d.ts`
- `backend/src/routes/index.ts`
- `backend/src/routes/health.routes.ts`
- `backend/src/routes/auth.routes.ts`
- `backend/src/routes/contractors.routes.ts`
- `backend/src/routes/projects.routes.ts`
- `backend/src/routes/evidence.routes.ts`
- `backend/src/routes/attestations.routes.ts`
- `backend/src/routes/verifications.routes.ts`
- `backend/src/routes/disputes.routes.ts`
- `backend/src/routes/corrections.routes.ts`
- `backend/src/routes/variations.routes.ts`
- `backend/src/routes/passports.routes.ts`
- `backend/src/routes/blockchain.routes.ts`
- `backend/src/routes/public.routes.ts`
- `backend/src/routes/crb.routes.ts`
- `backend/src/routes/nest.routes.ts`
- `backend/src/controllers/auth.controller.ts`
- `backend/src/controllers/health.controller.ts`
- `backend/src/controllers/integrations.controller.ts`
- `backend/src/services/auth.service.ts`
- `backend/src/services/attestation.service.ts`
- `backend/src/services/audit.service.ts`
- `backend/src/services/storage/StorageService.ts`
- `backend/src/services/storage/LocalFilesystemStorageService.ts`
- `backend/src/middleware/authenticate.ts`
- `backend/src/middleware/authorize.ts`
- `backend/src/middleware/errorHandler.ts`
- `backend/src/blockchain/BlockchainService.ts`
- `backend/src/integrations/crb/CrbIntegrationAdapter.ts`
- `backend/src/integrations/crb/MockCrbIntegrationAdapter.ts`
- `backend/src/integrations/nest/NestIntegrationAdapter.ts`
- `backend/src/integrations/nest/MockNestIntegrationAdapter.ts`
- `backend/src/repositories/prisma.ts`
- `backend/src/repositories/user.repository.ts`
- `backend/src/utils/jwt.ts`
- `backend/src/utils/password.ts`
- `backend/src/utils/hash.ts`
- `backend/test/health.test.ts`
- `backend/.env` (key names only; values not recorded)
- `backend/storage/.gitkeep`

### Frontend

- `frontend/package.json`
- `frontend/vite.config.ts`
- `frontend/tsconfig.json`
- `frontend/tsconfig.app.json`
- `frontend/tsconfig.node.json`
- `frontend/tailwind.config.js`
- `frontend/postcss.config.js`
- `frontend/eslint.config.js`
- `frontend/index.html`
- `frontend/.env.example`
- `frontend/.env` (key names only)
- `frontend/src/main.tsx`
- `frontend/src/vite-env.d.ts`
- `frontend/src/styles/index.css`
- `frontend/src/app/App.tsx`
- `frontend/src/app/router.tsx`
- `frontend/src/app/providers/AppProviders.tsx`
- `frontend/src/pages/LoginPage.tsx`
- `frontend/src/pages/DashboardPage.tsx`
- `frontend/src/pages/PublicVerificationPage.tsx`
- `frontend/src/pages/PlaceholderPage.tsx`
- `frontend/src/pages/UnauthorizedPage.tsx`
- `frontend/src/pages/ForbiddenPage.tsx`
- `frontend/src/features/auth/AuthContext.tsx`
- `frontend/src/features/auth/ProtectedRoute.tsx`
- `frontend/src/features/auth/GuestRoute.tsx`
- `frontend/src/features/auth/RoleGate.tsx`
- `frontend/src/hooks/useAuth.ts`
- `frontend/src/services/api/client.ts`
- `frontend/src/services/api/auth.ts`
- `frontend/src/services/api/errors.ts`
- `frontend/src/utils/session.ts`
- `frontend/src/utils/cn.ts`
- `frontend/src/types/auth.ts`
- `frontend/src/types/roles.ts`
- `frontend/src/types/status.ts`
- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/MobileNav.tsx`
- `frontend/src/components/layout/PublicLayout.tsx`
- `frontend/src/components/navigation/navConfig.ts`
- `frontend/src/components/navigation/RoleAwareNav.tsx`
- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/StatusBadge.tsx`
- `frontend/src/components/ui/PageHeader.tsx`
- `frontend/src/components/feedback/EmptyState.tsx`
- `frontend/src/components/feedback/ErrorState.tsx`
- `frontend/src/components/feedback/LoadingState.tsx`
- `frontend/src/tests/setup.ts`
- `frontend/src/tests/renderApp.tsx`
- `frontend/src/tests/login.test.tsx`
- `frontend/src/tests/logout.test.tsx`
- `frontend/src/tests/navigation.test.tsx`
- `frontend/src/tests/forbidden.test.tsx`
- `frontend/src/tests/unauthorized.test.tsx`
- `frontend/src/tests/protected-route.test.tsx`
- `frontend/src/api/` (empty directory)

### Contracts

- `contracts/package.json`
- `contracts/hardhat.config.ts`
- `contracts/tsconfig.json`
- `contracts/contracts/ContractorProofRegistry.sol`
- `contracts/scripts/deploy.ts`
- `contracts/test/ContractorProofRegistry.ts`

Lockfiles were confirmed present and not copied.

---

End of inventory. No application source was changed. This report was added at `docs/architecture/repository-inventory.md`.
