import { Prisma } from "@prisma/client";
import { NestAdapterError, type ProcurementLookup } from "../integrations/nest/NestProcurementAdapter";
import { nestProcurementAdapter } from "../integrations/nest";
import { ApiError } from "../http/errors";
import { contractorRepository } from "../repositories/contractor.repository";
import { procurementRepository } from "../repositories/procurement.repository";
import type { PublicUser } from "../types";

let adapterFactory: (() => ReturnType<typeof nestProcurementAdapter>) | null = null;

export function setNestProcurementAdapterFactory(factory?: () => ReturnType<typeof nestProcurementAdapter>): void {
  adapterFactory = factory ?? null;
}

function publicObservation(row: {
  id: string;
  ocid: string;
  releaseId: string;
  releaseDate: Date | null;
  tenderReference: string | null;
  title: string | null;
  description: string | null;
  buyerName: string | null;
  buyerIdentifier: string | null;
  procurementCategory: string | null;
  tenderStatus: string | null;
  awardStatus: string | null;
  awardDate: Date | null;
  contractReference: string | null;
  contractStatus: string | null;
  contractorName: string | null;
  contractorIdentifier: string | null;
  contractValue: Prisma.Decimal | null;
  contractCurrency: string | null;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  normalizedData: Prisma.JsonValue;
  sourceDigest: string;
  retrievedAt: Date;
}) {
  return {
    ...row,
    contractValue: row.contractValue?.toString() ?? null,
    releaseDate: row.releaseDate?.toISOString() ?? null,
    awardDate: row.awardDate?.toISOString() ?? null,
    contractStartDate: row.contractStartDate?.toISOString() ?? null,
    contractEndDate: row.contractEndDate?.toISOString() ?? null,
    retrievedAt: row.retrievedAt.toISOString(),
  };
}

function publicRecord(record: {
  id: string;
  sourceSystem: string;
  externalReference: string;
  sourceRecordId: string | null;
  sourceUrl: string;
  createdAt: Date;
  observations: Parameters<typeof publicObservation>[0][];
}) {
  return {
    id: record.id,
    sourceSystem: record.sourceSystem,
    externalReference: record.externalReference,
    sourceRecordId: record.sourceRecordId,
    sourceReference: record.sourceUrl,
    createdAt: record.createdAt.toISOString(),
    observations: record.observations.map(publicObservation),
  };
}

function adapterError(error: unknown): never {
  if (!(error instanceof NestAdapterError)) throw error;
  const status = error.code === "NEST_INVALID_RESPONSE" ? 502
    : error.code === "NEST_NOT_FOUND" ? 404
      : error.code === "NEST_NOT_CONFIGURED" ? 503
        : error.code === "NEST_TIMEOUT" || error.code === "NEST_UNAVAILABLE" ? 503
          : 400;
  throw new ApiError(status, error.code, error.message);
}

export const procurementService = {
  async sync(actor: PublicUser, ocid: string) {
    if (actor.role !== "ADMIN" && actor.role !== "PROCUREMENT_OFFICER") {
      throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    }
    let lookup: ProcurementLookup;
    try {
      lookup = await (adapterFactory ?? nestProcurementAdapter)().lookupByOcid(ocid);
    } catch (error) {
      return adapterError(error);
    }
    const record = await procurementRepository.appendLookup(lookup);
    return publicRecord(record);
  },

  async listForContractor(contractorId: string) {
    const links = await procurementRepository.listForContractor(contractorId);
    return links.map((link) => ({
      linkedAt: link.linkedAt.toISOString(),
      linkedById: link.linkedById,
      record: publicRecord(link.procurementRecord),
    }));
  },

  async linkToContractor(actor: PublicUser, contractorId: string, recordId: string) {
    if (actor.role !== "ADMIN" && actor.role !== "PROCUREMENT_OFFICER") {
      throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    }
    const contractor = await contractorRepository.getContractorById(contractorId);
    if (!contractor) throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    const record = await procurementRepository.findRecordById(recordId);
    if (!record) throw new ApiError(404, "PROCUREMENT_RECORD_NOT_FOUND", "procurement record not found");
    try {
      await procurementRepository.linkToContractor(contractorId, recordId, actor.id);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ApiError(409, "PROCUREMENT_RECORD_ALREADY_LINKED", "procurement record is already linked to this contractor");
      }
      throw error;
    }
    return { contractorId, procurementRecordId: recordId, linkedById: actor.id };
  },
};