# Development

## Prerequisites

- Node.js 20+
- npm
- Docker (PostgreSQL only)

## Environment

Copy the root example file:

```bash
cp .env.example backend/.env
```

Set `JWT_SECRET` to a long random value before using authentication locally.

`BLOCKCHAIN_PRIVATE_KEY` may stay empty for local Hardhat. Hardhat then uses its default development accounts. Do not put a production key in source control.

## Start PostgreSQL

```bash
docker compose up -d
```

PostgreSQL is published on host port `5433` to avoid colliding with a local PostgreSQL on `5432`. Connect with `DATABASE_URL` from `.env.example`.

## Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run dev
```

API: `http://localhost:4000`

Health: `http://localhost:4000/health`

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: `http://localhost:5173`

The frontend talks to the backend through `frontend/src/services/api/client.ts` and `VITE_API_ORIGIN` (see `frontend/.env.example`). Architecture baseline: [docs/architecture/](architecture/README.md).

## Contracts

```bash
cd contracts
npm install
npx hardhat test
npx hardhat node
```

In another terminal:

```bash
cd contracts
npx hardhat run scripts/deploy.ts --network localhost
```

Copy the printed address into `CONTRACT_ADDRESS`.

## Validate without running servers

```bash
cd frontend && npm run build
cd backend && npm run build && npx prisma validate
cd contracts && npx hardhat test
```

## Local evidence files

Uploaded files will be stored under `backend/storage` (`STORAGE_PATH`). That directory is gitignored except for `.gitkeep`.
