import {
  NestAdapterError,
  sha256SourceRecord,
  validateOcid,
  type NestProcurementAdapter,
  type ProcurementLookup,
} from "./NestProcurementAdapter";

type SandboxRelease = {
  id: string;
  date: string;
  tender: { id: string; title: string; description: string; status: string; mainProcurementCategory: string };
  buyer: { id: string; name: string };
  awards: Array<{ id: string; status: string; date: string; suppliers: Array<{ id: string; name: string }> }>;
  contracts: Array<{
    id: string;
    status: string;
    awardID: string;
    value: { amount: number; currency: string };
    period: { startDate: string; endDate: string };
  }>;
};

const RELEASES: Record<string, { recordId: string; releases: SandboxRelease[] }> = {
  "ocds-sandbox-001": {
    recordId: "sandbox-record-001",
    releases: [
      {
        id: "release-001-initial",
        date: "2026-01-10T00:00:00Z",
        tender: { id: "NEST-DEMO-001", title: "DEMO: Works package one", description: "Fictional sandbox procurement record.", status: "active", mainProcurementCategory: "works" },
        buyer: { id: "BUYER-DEMO-001", name: "DEMO Public Works Unit" },
        awards: [],
        contracts: [],
      },
      {
        id: "release-001-award",
        date: "2026-02-10T00:00:00Z",
        tender: { id: "NEST-DEMO-001", title: "DEMO: Works package one", description: "Fictional sandbox procurement record.", status: "complete", mainProcurementCategory: "works" },
        buyer: { id: "BUYER-DEMO-001", name: "DEMO Public Works Unit" },
        awards: [{ id: "AWARD-DEMO-001", status: "active", date: "2026-02-01T00:00:00Z", suppliers: [{ id: "SUPPLIER-DEMO-001", name: "DEMO Fictional Builder Ltd" }] }],
        contracts: [{ id: "CONTRACT-DEMO-001", status: "active", awardID: "AWARD-DEMO-001", value: { amount: 1250000, currency: "TZS" }, period: { startDate: "2026-03-01T00:00:00Z", endDate: "2027-02-28T00:00:00Z" } }],
      },
    ],
  },
  "ocds-sandbox-002": {
    recordId: "sandbox-record-002",
    releases: [
      {
        id: "release-002-tender",
        date: "2026-03-10T00:00:00Z",
        tender: { id: "NEST-DEMO-002", title: "DEMO: Supply package two", description: "Fictional sandbox procurement record.", status: "planned", mainProcurementCategory: "goods" },
        buyer: { id: "BUYER-DEMO-002", name: "DEMO Municipal Services Unit" },
        awards: [],
        contracts: [],
      },
    ],
  },
};

export class SandboxNestAdapter implements NestProcurementAdapter {
  readonly sourceSystem = "SANDBOX_DEMO" as const;

  async lookupByOcid(input: string): Promise<ProcurementLookup> {
    const ocid = validateOcid(input);
    const record = RELEASES[ocid];
    if (!record) {
      throw new NestAdapterError("NEST_NOT_FOUND", "Sandbox NeST record was not found.");
    }
    return {
      sourceSystem: this.sourceSystem,
      externalReference: ocid,
      sourceRecordId: record.recordId,
      sourceReference: `SANDBOX_DEMO:${ocid}`,
      observations: record.releases.map((release) => {
        const award = release.awards[0];
        const contract = release.contracts[0];
        return {
          ocid,
          releaseId: release.id,
          releaseDate: release.date,
          tenderReference: release.tender.id,
          title: release.tender.title,
          description: release.tender.description,
          buyerName: release.buyer.name,
          buyerIdentifier: release.buyer.id,
          procurementCategory: release.tender.mainProcurementCategory,
          tenderStatus: release.tender.status,
          awardStatus: award?.status ?? null,
          awardDate: award?.date ?? null,
          contractReference: contract?.id ?? null,
          contractStatus: contract?.status ?? null,
          contractorName: award?.suppliers[0]?.name ?? null,
          contractorIdentifier: award?.suppliers[0]?.id ?? null,
          contractValue: contract ? String(contract.value.amount) : null,
          contractCurrency: contract?.value.currency ?? null,
          contractStartDate: contract?.period.startDate ?? null,
          contractEndDate: contract?.period.endDate ?? null,
          normalizedData: {
            tender: release.tender,
            buyer: release.buyer,
            awards: release.awards,
            contracts: release.contracts,
          },
          sourceDigest: sha256SourceRecord(release),
        };
      }),
    };
  }
}

export const sandboxNestAdapter = new SandboxNestAdapter();