# Architecture

**The official baseline is [docs/architecture/](architecture/README.md).** This page is a short pointer so older links do not drift.

## Canonical path

```
Browser
  → frontend/src/services/api/client.ts  (VITE_API_ORIGIN + /api/v1)
  → Express /api/v1/*
  → authenticate + authorize + ownership
  → controllers → services → repositories
  → PostgreSQL (Prisma) + StorageService
  → verification (SHA-256 compare)
  → policy + assertCanAttest
  → BlockchainService (hashes/ids only)
  → derived Passport / public verification
```

Do not use `src/api/client.ts` or `VITE_API_BASE_URL`. Those names are obsolete.

## Packages

```
frontend/     React + Vite + TypeScript + Tailwind
backend/      Express + TypeScript + Prisma + JWT/RBAC
contracts/    Hardhat + Solidity 0.8.24 + ethers.js
```

Institutional adapters remain `SYNTHETIC_DEMO`. Blockchain does not store documents. A contractor must not attest their own evidence (`assertCanAttest`).
