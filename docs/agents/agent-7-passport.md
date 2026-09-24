# Agent 7 — Passport / public verification

## Owns

Derived Passport projection, `POST /api/v1/public/verify`, `/verify` page behavior (with Agent 1).

## Canonical dependencies

- ADR-0007, ADR-0003
- Same compare function as Agent 5
- No Passport table

## Must do (Phase 4)

- GET passports from live project/evidence/attestation/proof data
- Public POST: file + evidence id/version → MATCH/MISMATCH/PENDING/UNAVAILABLE
- Public copy: MATCH is fingerprint only
- Omit storage paths, emails, password material

## Must not

- Persist Passport without a new ADR
- Hash only in the browser as authority
- Present mock CRB/NeST as live
- Show trust scores

## Depends on

Agent 5 compare + stored versions. Agent 2 routes. Agent 1 UI.
