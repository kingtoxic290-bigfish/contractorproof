# Privileged user provisioning

Status: Agent 6 (2026-09-24)

Public `POST /api/v1/auth/register` may create **CONTRACTOR** or **CLIENT** only.  
`ADMIN`, `AUDITOR`, `PROCUREMENT_OFFICER`, and `CONSULTANT_ENGINEER` cannot be self-registered.

## First ADMIN (operator seed)

Credentials come from the environment. They are never hardcoded.

```bash
export ADMIN_EMAIL="operator@example.com"
export ADMIN_PASSWORD="a-long-random-password"
export ADMIN_FULL_NAME="Operator Admin"
cd backend
npx prisma db seed
```

The seed is idempotent. It does nothing when `ADMIN_EMAIL` / `ADMIN_PASSWORD` are unset, or when that email already exists.

There is no unauthenticated HTTP “create admin” endpoint.

## Later privileged users

Authenticated **ADMIN** only:

```http
POST /api/v1/users
Authorization: Bearer <admin-jwt>
```

```json
{ "email": "auditor@example.com", "password": "at-least-8-chars", "fullName": "Auditor", "role": "AUDITOR" }
```

Allowed roles: `ADMIN`, `AUDITOR`, `PROCUREMENT_OFFICER`, `CONSULTANT_ENGINEER`.  
Password hashes are never returned.

## Local JWT fallback

Production refuses to start without a unique `JWT_SECRET` (≥ 32 characters, not a well-known default).

Development/test may use `JWT_SECRET` from `.env`. A missing secret is allowed only when `NODE_ENV=test` or `ALLOW_INSECURE_JWT_SECRET=true`.
