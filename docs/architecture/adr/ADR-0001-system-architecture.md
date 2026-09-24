# ADR-0001 System architecture

## Status

Accepted (Agent 0, 2026-09-24)

## Context

The repository already has three packages, PostgreSQL via Compose, JWT auth, a Prisma domain schema, and a Hardhat registry. The inventory showed disconnected utilities and 501 domain routes. Agents need a single orchestration model so they do not fork stacks.

## Decision

Keep the existing three-package architecture:

React frontend → Express API → application services → PostgreSQL + `StorageService` → verification / policy / attestation → backend-signed blockchain proof → derived Passport / public verification.

The backend is the authorization and orchestration boundary. Existing stacks (React/Vite, Express/Prisma, Hardhat/ethers) are not replaced.

## Alternatives Considered

- Greenfield rewrite or monorepo workspaces — rejected; working auth and schema would be discarded.
- Frontend talking to chain and storage — rejected; keys and files would leak.
- Chain as primary database — rejected; RBAC, files, and search do not belong on-chain.

## Consequences

- Agents extend `frontend/`, `backend/`, `contracts/` in place.
- New domain behavior lands in services, not in React.
- Inventory open questions about “which client / which env var” are closed by usage: `frontend/src/services/api/client.ts` and `VITE_API_ORIGIN`.

## Affected Agents

All (0–9)
