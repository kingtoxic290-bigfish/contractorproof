import { Prisma, type ProcurementSourceSystem } from "@prisma/client";
import type { ProcurementLookup } from "../integrations/nest/NestProcurementAdapter";
import { prisma } from "./prisma";

const procurementRecordInclude = {
  observations: { orderBy: [{ retrievedAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.ProcurementRecordInclude;

export const procurementRepository = {
  async appendLookup(lookup: ProcurementLookup) {
    return prisma.$transaction(async (tx) => {
      const record = await tx.procurementRecord.upsert({
        where: {
          sourceSystem_externalReference: {
            sourceSystem: lookup.sourceSystem as ProcurementSourceSystem,
            externalReference: lookup.externalReference,
          },
        },
        create: {
          sourceSystem: lookup.sourceSystem as ProcurementSourceSystem,
          externalReference: lookup.externalReference,
          sourceRecordId: lookup.sourceRecordId,
          sourceUrl: lookup.sourceReference,
        },
        update: {
          sourceRecordId: lookup.sourceRecordId,
          sourceUrl: lookup.sourceReference,
        },
      });

      await tx.procurementObservation.deleteMany({
        where: { procurementRecordId: record.id },
      });

      for (const observation of lookup.observations) {
        await tx.procurementObservation.create({
          data: {
            procurementRecordId: record.id,
            ...observation,
            releaseDate: observation.releaseDate ? new Date(observation.releaseDate) : null,
            awardDate: observation.awardDate ? new Date(observation.awardDate) : null,
            contractStartDate: observation.contractStartDate ? new Date(observation.contractStartDate) : null,
            contractEndDate: observation.contractEndDate ? new Date(observation.contractEndDate) : null,
            contractValue: observation.contractValue === null ? null : new Prisma.Decimal(observation.contractValue),
            normalizedData: observation.normalizedData as Prisma.InputJsonValue,
          },
        });
      }

      return tx.procurementRecord.findUniqueOrThrow({
        where: { id: record.id },
        include: procurementRecordInclude,
      });
    });
  },

  listForContractor(contractorId: string) {
    return prisma.procurementLink.findMany({
      where: { contractorId },
      include: {
        procurementRecord: { include: procurementRecordInclude },
      },
      orderBy: [{ linkedAt: "desc" }, { id: "asc" }],
    });
  },

  async linkToContractor(contractorId: string, procurementRecordId: string, linkedById: string) {
    return prisma.procurementLink.create({
      data: { contractorId, procurementRecordId, linkedById },
    });
  },

  findRecordById(id: string) {
    return prisma.procurementRecord.findUnique({ where: { id } });
  },
};