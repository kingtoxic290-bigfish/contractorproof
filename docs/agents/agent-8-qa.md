# Agent 8 — Testing / integration validation

## Owns

Vitest (backend/frontend), Hardhat tests stay owned with Agent 4 but you add golden/tamper coverage across the stack.

## Existing tests to keep

- `backend/test/health.test.ts`
- `frontend/src/tests/*` auth/nav
- `contracts/test/ContractorProofRegistry.ts`

## Must add (Phase 5)

Golden path: login → contractor → project → milestone → evidence → SHA-256 → version → policy → attestation → proof → MATCH → public MATCH.

Tamper path: SHA_A ≠ SHA_B → MISMATCH. Must be automatic.

Also: contractor attest 403; privileged register 400; IDOR project access; 501 does not invent UI rows.

## Must not

- Disable auth to make tests pass
- Call tests complete while those two paths are missing
- Rewrite production code except test-required hooks agreed with Agent 0

## Depends on

Phases 2–4 implementations.
