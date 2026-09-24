# ContractorProof

Evidence-verification and provenance layer for construction projects.

ContractorProof connects project milestones to authorized professional attestations, SHA-256 evidence fingerprints, and tamper-evident blockchain records.

It does **not** replace CRB, NeST, PPRA, contractor registration, procurement, or professional engineering inspection.

Blockchain proves integrity of the recorded evidence or event. It does **not** prove that the underlying construction claim is true.

This repository is a Phase 1 scaffold: packages build, the health endpoint works, Prisma validates, and the Hardhat environment runs. Authenticated GET APIs for contractors, projects, and project-scoped milestones are implemented. Evidence, verification, passports, disputes, corrections, and variations remain structured stubs.

The official architecture baseline (Agent 0) lives in [docs/architecture/](docs/architecture/README.md). Agents must not introduce competing models, API clients, or hash/verification semantics.

## Packages

| Path | Stack |
| --- | --- |
| `frontend/` | React, Vite, TypeScript, Tailwind CSS |
| `backend/` | Node.js, Express, TypeScript, Prisma, JWT, RBAC |
| `contracts/` | Hardhat, Solidity, ethers.js |

## Quick start

```bash
docker compose up -d
cp .env.example backend/.env
cp frontend/.env.example frontend/.env
# PostgreSQL is on host port 5433 (see DATABASE_URL in .env.example)

cd backend && npm install && npx prisma generate && npx prisma migrate dev && npm run dev
cd ../contracts && npm install && npx hardhat node
cd ../frontend && npm install && npm run dev
```

See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for details.

## Documentation

- [Architecture baseline](docs/architecture/README.md)
- [Frozen specification](docs/PROJECT_SPECIFICATION.md)
- [Legacy architecture note](docs/ARCHITECTURE.md) (defers to the baseline)
- [API](docs/api/api-overview.md)
- [Development](docs/DEVELOPMENT.md)
