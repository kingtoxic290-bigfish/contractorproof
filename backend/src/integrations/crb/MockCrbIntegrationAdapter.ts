import type { CrbIntegrationAdapter, CrbLookupResult } from "./CrbIntegrationAdapter";

const SYNTHETIC_RECORDS: Record<string, Omit<CrbLookupResult, "source" | "found" | "crbRegistrationNumber">> = {
  "CRB-DEMO-001": {
    crbCategory: "Works",
    crbType: "Building",
    crbClass: "Class I",
    crbStatus: "ACTIVE",
    crbLastVerifiedAt: "2026-01-15T00:00:00.000Z",
  },
  "CRB-DEMO-002": {
    crbCategory: "Works",
    crbType: "Civil",
    crbClass: "Class II",
    crbStatus: "ACTIVE",
    crbLastVerifiedAt: "2026-03-02T00:00:00.000Z",
  },
};

export class MockCrbIntegrationAdapter implements CrbIntegrationAdapter {
  async lookupByRegistrationNumber(registrationNumber: string): Promise<CrbLookupResult> {
    const record = SYNTHETIC_RECORDS[registrationNumber.trim().toUpperCase()];
    if (!record) {
      return {
        source: "SYNTHETIC_DEMO",
        found: false,
        crbRegistrationNumber: registrationNumber,
        crbCategory: null,
        crbType: null,
        crbClass: null,
        crbStatus: null,
        crbLastVerifiedAt: null,
      };
    }

    return {
      source: "SYNTHETIC_DEMO",
      found: true,
      crbRegistrationNumber: registrationNumber.trim().toUpperCase(),
      ...record,
    };
  }
}

export const mockCrbIntegrationAdapter = new MockCrbIntegrationAdapter();
