# NeST Procurement Data Integration

## Role and Source

NeST is Tanzania's national e-procurement system. The PPRA NeST Data Portal publishes public procurement information using OCDS, including tender, award, contract, and participating-organization data. ContractorProof treats this as procurement context, not regulatory identity verification, project performance evidence, contractor endorsement, or trust assessment.

The public portal documents an HTTPS API base at `https://nest.go.tz/gateway/nest-data-portal-api/api/`, including a Record Package lookup at `records/{ocid}` and Release Package endpoints. The portal page was reachable during implementation, but a direct API request timed out; the exact live response could not be independently captured in this environment. Normalization therefore has fixture coverage based on the documented OCDS Record Package and Release structures, and requires live compatibility validation before production use.

No GovESB dependency, website scraping, private endpoint, credential, or privileged NeST integration is used or claimed.

## Adapter Modes

`NEST_MODE` defaults to `sandbox`. The deterministic sandbox adapter returns fictional data marked `SANDBOX_DEMO`; these records are not real NeST records. `NEST_MODE=public_ocds` opts into the public OCDS API. The source is retained as `NEST_OCDS_PUBLIC`, not as an authenticated ContractorProof verification. `NEST_OCDS_BASE_URL` may be set only to the exact HTTPS NeST host and documented API path; other hosts, paths, ports, user information, and non-HTTPS URLs are rejected. Unknown modes fail closed.

The public adapter requests only a record by OCID; users cannot provide a URL. It applies an abort timeout, response-size cap, JSON content-type and package validation, rejects redirects, and exposes stable error codes for invalid input, invalid responses, timeouts, unavailable service, and missing records. It does not log upstream payloads or credentials.

## Data and History

`ProcurementRecord` identifies the source-system/OCID pair. Each retrieval appends a `ProcurementObservation` per returned release, preserving `releaseId`, normalized OCDS fields, retrieval time, source reference, and SHA-256 digest of the source release. Earlier observations are not overwritten. Procurement rows are off-chain; no procurement data or digest creates a blockchain event.

The normalized fields are limited to public buyer, tender, award, contract, value/currency, dates, and supplier identity fields returned by the source. Raw OCDS payloads are not stored. The normalized subset avoids unnecessary party details.

## Contractor Linking

A retrieved record is unlinked by default. Similar or equal names never create a ContractorProof association. An ADMIN or PROCUREMENT_OFFICER must perform the explicit contractor link operation. The link records the actor and time. No contractor-facing create/edit API exists.

Contractors can read linked procurement records for their own profile. Clients can read records only for a contractor currently assigned to one of their projects. ADMIN, AUDITOR, and PROCUREMENT_OFFICER retain existing oversight access. Contractor linking/sync operations are restricted to ADMIN and PROCUREMENT_OFFICER.

## API

- `POST /api/v1/procurement/sync` accepts an OCID; ADMIN/PROCUREMENT_OFFICER only. It imports source records and does not associate them with a contractor.
- `POST /api/v1/contractors/:contractorId/procurement/:recordId/link` explicitly associates a previously imported record; ADMIN/PROCUREMENT_OFFICER only.
- `GET /api/v1/contractors/:contractorId/procurement` returns linked records after contractor/project relationship authorization.
- Existing authenticated Passport endpoints include linked procurement provenance in the contractor projection.

All successful responses use the existing `{ data, meta }` envelope and errors use `{ error: { code, message, requestId } }`.

## Passport and Limitations

The Passport separates CRB regulatory registration from NeST procurement information. The UI says “Procurement information sourced from NeST” and labels sandbox entries DEMO/SANDBOX. It does not say “contractor verified by NeST” and does not generate a trust, reputation, or performance score. A published award or contract does not establish successful performance.

A current NeST response could not be fetched in the implementation environment, so live public endpoint behavior remains unverified. No private credentials or privileged access are configured. The existing project fields and synthetic lookup remain for compatibility and are not treated as the versioned procurement record history.
