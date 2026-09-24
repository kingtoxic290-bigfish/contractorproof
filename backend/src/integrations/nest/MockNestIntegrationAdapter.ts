import type { NestIntegrationAdapter, NestLookupResult } from "./NestIntegrationAdapter";

const SYNTHETIC_RECORDS: Record<string, NestLookupResult> = {
  "NEST-DEMO-100": {
    source: "SYNTHETIC_DEMO",
    found: true,
    nestTenderReference: "NEST-DEMO-100",
    nestContractReference: "CNT-DEMO-100",
    ocid: "ocds-demo-100",
    procuringEntity: "Demo Procuring Entity",
    contractStatus: "ACTIVE",
    contractStartDate: "2026-02-01",
    contractEndDate: "2027-01-31",
  },
};

export class MockNestIntegrationAdapter implements NestIntegrationAdapter {
  async lookupByReference(reference: string): Promise<NestLookupResult> {
    const record = SYNTHETIC_RECORDS[reference.trim().toUpperCase()];
    if (!record) {
      return {
        source: "SYNTHETIC_DEMO",
        found: false,
        nestTenderReference: reference,
        nestContractReference: null,
        ocid: null,
        procuringEntity: null,
        contractStatus: null,
        contractStartDate: null,
        contractEndDate: null,
      };
    }
    return record;
  }
}

export const mockNestIntegrationAdapter = new MockNestIntegrationAdapter();
