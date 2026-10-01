import { createHash } from "node:crypto";

export type ProcurementSourceSystem = "SANDBOX_DEMO" | "NEST_OCDS_PUBLIC";

export type ProcurementObservationInput = {
  ocid: string;
  releaseId: string;
  releaseDate: string | null;
  tenderReference: string | null;
  title: string | null;
  description: string | null;
  buyerName: string | null;
  buyerIdentifier: string | null;
  procurementCategory: string | null;
  tenderStatus: string | null;
  awardStatus: string | null;
  awardDate: string | null;
  contractReference: string | null;
  contractStatus: string | null;
  contractorName: string | null;
  contractorIdentifier: string | null;
  contractValue: string | null;
  contractCurrency: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  normalizedData: Record<string, unknown>;
  sourceDigest: string;
};

export type ProcurementLookup = {
  sourceSystem: ProcurementSourceSystem;
  externalReference: string;
  sourceRecordId: string | null;
  sourceReference: string;
  observations: ProcurementObservationInput[];
};

export class NestAdapterError extends Error {
  constructor(
    public readonly code: "NEST_TIMEOUT" | "NEST_UNAVAILABLE" | "NEST_INVALID_RESPONSE" | "NEST_INVALID_OCID" | "NEST_NOT_FOUND" | "NEST_NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
    this.name = "NestAdapterError";
  }
}

export interface NestProcurementAdapter {
  readonly sourceSystem: ProcurementSourceSystem;
  lookupByOcid(ocid: string): Promise<ProcurementLookup>;
}

export function sha256SourceRecord(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function validateOcid(value: string): string {
  const ocid = value.trim();
  if (!ocid || ocid.length > 200 || /[\u0000-\u001f\u007f]/.test(ocid)) {
    throw new NestAdapterError("NEST_INVALID_OCID", "A valid OCID is required.");
  }
  return ocid;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validDate(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  if (!Number.isFinite(Date.parse(candidate))) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS response contains an invalid date.");
  }
  return new Date(candidate).toISOString();
}

function oneRecordPackage(value: unknown, requestedOcid: string): Record<string, unknown> {
  if (!isRecord(value) || !Array.isArray(value.records)) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS record package is malformed.");
  }
  const record = value.records.find((item) => isRecord(item) && item.ocid === requestedOcid);
  if (!isRecord(record)) {
    throw new NestAdapterError("NEST_NOT_FOUND", "NeST did not return the requested OCID.");
  }
  return record;
}

function parseRelease(release: unknown, requestedOcid: string): ProcurementObservationInput {
  if (!isRecord(release) || release.ocid !== requestedOcid) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS release is malformed or has a different OCID.");
  }
  const releaseId = text(release.id);
  if (!releaseId) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS release has no release ID.");
  }

  const tender = isRecord(release.tender) ? release.tender : {};
  const buyer = isRecord(release.buyer) ? release.buyer : {};
  const awards = Array.isArray(release.awards) ? release.awards.filter(isRecord) : [];
  const contracts = Array.isArray(release.contracts) ? release.contracts.filter(isRecord) : [];
  const award = awards[0] ?? {};
  const contract = contracts[0] ?? {};
  const suppliers = Array.isArray(award.suppliers) ? award.suppliers.filter(isRecord) : [];
  const supplier = suppliers[0] ?? {};
  const value = isRecord(contract.value) ? contract.value : {};
  const period = isRecord(contract.period) ? contract.period : {};
  const amount = typeof value.amount === "number" && Number.isFinite(value.amount)
    ? String(value.amount)
    : null;

  const normalizedData = {
    tender: {
      id: text(tender.id),
      title: text(tender.title),
      description: text(tender.description),
      status: text(tender.status),
      mainProcurementCategory: text(tender.mainProcurementCategory),
    },
    buyer: { id: text(buyer.id), name: text(buyer.name) },
    awards: awards.map((item) => ({
      id: text(item.id),
      status: text(item.status),
      date: validDate(item.date),
      suppliers: Array.isArray(item.suppliers)
        ? item.suppliers.filter(isRecord).map((party) => ({ id: text(party.id), name: text(party.name) }))
        : [],
    })),
    contracts: contracts.map((item) => {
      const contractValue = isRecord(item.value) ? item.value : {};
      const contractPeriod = isRecord(item.period) ? item.period : {};
      return {
        id: text(item.id),
        status: text(item.status),
        awardID: text(item.awardID),
        value: {
          amount: typeof contractValue.amount === "number" && Number.isFinite(contractValue.amount)
            ? String(contractValue.amount)
            : null,
          currency: text(contractValue.currency),
        },
        period: {
          startDate: validDate(contractPeriod.startDate),
          endDate: validDate(contractPeriod.endDate),
        },
      };
    }),
  };

  return {
    ocid: requestedOcid,
    releaseId,
    releaseDate: validDate(release.date),
    tenderReference: text(tender.id),
    title: text(tender.title),
    description: text(tender.description),
    buyerName: text(buyer.name),
    buyerIdentifier: text(buyer.id),
    procurementCategory: text(tender.mainProcurementCategory),
    tenderStatus: text(tender.status),
    awardStatus: text(award.status),
    awardDate: validDate(award.date),
    contractReference: text(contract.id),
    contractStatus: text(contract.status),
    contractorName: text(supplier.name),
    contractorIdentifier: text(supplier.id),
    contractValue: amount,
    contractCurrency: text(value.currency),
    contractStartDate: validDate(period.startDate),
    contractEndDate: validDate(period.endDate),
    normalizedData,
    sourceDigest: sha256SourceRecord(release),
  };
}

export function normalizeOcdsRecordPackage(value: unknown, requestedOcid: string): {
  sourceRecordId: string | null;
  observations: ProcurementObservationInput[];
} {
  const record = oneRecordPackage(value, requestedOcid);
  const releases = Array.isArray(record.releases) ? record.releases : [];
  if (releases.length === 0) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS record package contains no releases.");
  }
  const observations = releases.map((release) => parseRelease(release, requestedOcid));
  return { sourceRecordId: text(record.id), observations };
}