import { BlockchainEventType, type Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const passportInclude = {
  contractor: {
    select: {
      id: true,
      legalName: true,
      crbRegistrationNumber: true,
      crbCategory: true,
      crbType: true,
      crbClass: true,
      crbStatus: true,
      crbLastVerifiedAt: true,
      crbSource: true,
    },
  },
  milestones: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      policy: {
        select: { id: true, name: true, requiredApprovals: true, allowedRoles: true },
      },
      evidence: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          versions: {
            orderBy: [{ versionNumber: "asc" }, { id: "asc" }],
            include: {
              verifications: {
                orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                select: {
                  id: true,
                  status: true,
                  source: true,
                  createdAt: true,
                },
              },
            },
          },
          attestations: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: {
              id: true,
              milestoneId: true,
              decision: true,
              verifierRole: true,
              createdAt: true,
            },
          },
        },
      },
    },
  },
  blockchainEvents: {
    where: { eventType: { in: [BlockchainEventType.VERIFICATION, BlockchainEventType.ATTESTATION] } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      eventType: true,
      referenceId: true,
      evidenceHash: true,
      txHash: true,
      blockNumber: true,
      createdAt: true,
    },
  },
} satisfies Prisma.ProjectInclude;

export type PassportProjectRow = Prisma.ProjectGetPayload<{ include: typeof passportInclude }>;

export const passportRepository = {
  findAccessible(where: Prisma.ProjectWhereInput): Promise<PassportProjectRow[]> {
    return prisma.project.findMany({
      where,
      include: passportInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  findById(projectId: string): Promise<PassportProjectRow | null> {
    return prisma.project.findUnique({
      where: { id: projectId },
      include: passportInclude,
    });
  },
};
