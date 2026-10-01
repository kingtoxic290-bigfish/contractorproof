import { CrbVerificationStatus } from "@prisma/client";
import {
  CRB_FAILURE_CODES,
  isValidCrbReference,
  type CrbAdapter,
  type CrbAdapterLookup,
} from "./CrbAdapter";

/**
 * Deterministic development/sandbox CRB adapter.
 *
 * These records are fictional development fixtures. They are NOT CRB data and
 * must never be presented as a real regulatory result. The `SANDBOX` source is
 * persisted on every record produced here so stored data always states which
 * adapter answered.
 *
 * A deterministic failure mode is exposed so the UNAVAILABLE path can be
 * exercised without depending on a flaky network.
 */
const SANDBOX_RECORDS: Record<string, Omit<CrbAdapterLookup, "registrationReference" | "failureCode">> = {
  "CRB-DEMO-001": {
    status: CrbVerificationStatus.REGISTERED,
    registrationNumber: "CRB/DEMO/001",
    registeredName: "Harbor Works Limited (sandbox record)",
    category: "Works",
    registrationClass: "Class I",
    registrationDate: "2026-01-15T00:00:00.000Z",
    expiryDate: "2027-01-14T00:00:00.000Z",
    externalReference: "SANDBOX-REF-001",
  },
  "CRB-DEMO-002": {
    status: CrbVerificationStatus.EXPIRED,
    registrationNumber: "CRB/DEMO/002",
    registeredName: "Quayside Civil Engineering (sandbox record)",
    category: "Works",
    registrationClass: "Class II",
    registrationDate: "2024-02-01T00:00:00.000Z",
    expiryDate: "2025-01-31T00:00:00.000Z",
    externalReference: "SANDBOX-REF-002",
  },
  "CRB-DEMO-003": {
    status: CrbVerificationStatus.SUSPENDED,
    registrationNumber: "CRB/DEMO/003",
    registeredName: "Riverside Structures (sandbox record)",
    category: "Works",
    registrationClass: "Class III",
    registrationDate: "2025-06-01T00:00:00.000Z",
    expiryDate: "2027-05-31T00:00:00.000Z",
    externalReference: "SANDBOX-REF-003",
  },
};

/** Reference that always simulates an upstream outage, for deterministic testing. */
export const SANDBOX_UNAVAILABLE_REFERENCE = "CRB-DEMO-000";

const NOT_FOUND: Omit<CrbAdapterLookup, "registrationReference" | "failureCode"> = {
  status: CrbVerificationStatus.NOT_REGISTERED,
  registrationNumber: null,
  registeredName: null,
  category: null,
  registrationClass: null,
  registrationDate: null,
  expiryDate: null,
  externalReference: null,
};

export class SandboxCrbAdapter implements CrbAdapter {
  readonly source = "SANDBOX" as const;

  isConfigured(): boolean {
    return true;
  }

  async lookup(registrationReference: string): Promise<CrbAdapterLookup> {
    const reference = registrationReference.trim().toUpperCase();

    if (!isValidCrbReference(reference)) {
      return {
        registrationReference,
        status: CrbVerificationStatus.INVALID_REFERENCE,
        registrationNumber: null,
        registeredName: null,
        category: null,
        registrationClass: null,
        registrationDate: null,
        expiryDate: null,
        externalReference: null,
        failureCode: "CRB_INVALID_REFERENCE",
      };
    }

    if (reference === SANDBOX_UNAVAILABLE_REFERENCE) {
      // Deliberate upstream failure. Reported as UNAVAILABLE, never NOT_REGISTERED.
      return {
        registrationReference: reference,
        status: CrbVerificationStatus.UNAVAILABLE,
        registrationNumber: null,
        registeredName: null,
        category: null,
        registrationClass: null,
        registrationDate: null,
        expiryDate: null,
        externalReference: null,
        failureCode: CRB_FAILURE_CODES.UNREACHABLE,
      };
    }

    const record = SANDBOX_RECORDS[reference];
    if (!record) {
      return { registrationReference: reference, ...NOT_FOUND, failureCode: null };
    }

    return { registrationReference: reference, ...record, failureCode: null };
  }
}

export const sandboxCrbAdapter = new SandboxCrbAdapter();