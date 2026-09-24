# Agent 9 — Security review

## Owns

Review after features exist (Phase 5). P0 list is already recorded for implementers.

## P0 checklist (do not implement the whole product; verify these)

1. No production JWT fallback secret
2. No public privileged registration
3. Domain routes have authn + authz + ownership
4. `assertCanAttest` enforced
5. No IDOR on contractor/project/evidence ids
6. No chain keys in frontend
7. No raw storage paths in API
8. Production 500 does not leak `Error.message`
9. Rate limiting before shared deploy
10. Security headers before shared deploy

## Must not

- Rewrite features instead of reviewing
- Approve mock CRB/NeST presented as live
- Approve frontend-authoritative verification

## Depends on

Agents 2, 5, 6, 7 implementations and Agent 8 tests.
