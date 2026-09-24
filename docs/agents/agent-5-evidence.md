# Agent 5 — Evidence / hashing / verification

## Owns

Upload validation, `StorageService` usage, `sha256Buffer`, EvidenceVersion writes, compare function.

## Canonical dependencies

- `backend/src/utils/hash.ts`
- `backend/src/services/storage/*`
- ADR-0003, ADR-0005
- Schema from Agent 3

## Must do (Phase 3)

- Official lifecycle: validate → store → SHA-256 → EvidenceVersion → metadata
- No silent overwrite
- One compare function for app and public verify
- Results only MATCH | MISMATCH | PENDING | UNAVAILABLE
- Do not expose storage paths

## Must not

- Authoritative hash in the browser
- A second hash algorithm
- Convert MISMATCH to VERIFIED
- Bypass `assertCanAttest` (that is Agent 6/2; you must not add an attest-by-contractor path)

## Depends on

Agent 3 migration. Agent 2 HTTP. Agent 6 authz on upload ownership.
