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
      procurementLinks: {
        orderBy: [{ linkedAt: "asc" }, { id: "asc" }],
        include: {
          procurementRecord: {
            include: {
              observations: { orderBy: [{ retrievedAt: "asc" }, { id: "asc" }] },
            },
          },
        },
      },
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
      corrections: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          originalEvent: {
            select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true },
          },
          originalEvidenceVersion: {
            select: { id: true, evidenceId: true, versionNumber: true, sha256: true, createdAt: true },
          },
          evidence: {
            select: {
              id: true,
              currentVersionId: true,
              versions: {
                orderBy: [{ versionNumber: "asc" }, { id: "asc" }],
                select: { id: true, versionNumber: true, sha256: true, createdAt: true },
              },
            },
          },
          correctionEvent: {
            select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true },
          },
          resolutions: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: {
              resolvedBy: { select: { role: true } },
              correctedEvidenceVersion: {
                select: { id: true, evidenceId: true, versionNumber: true, sha256: true, createdAt: true },
              },
            },
          },
        },
      },
      disputes: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        include: {
          raisedBy: { select: { role: true } },
          originalEvent: {
            select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true, createdAt: true },
          },
          disputeEvent: {
            select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true, createdAt: true },
          },
          resolutionEvent: {
            select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true, createdAt: true },
          },
          resolutions: {
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            include: { resolvedBy: { select: { role: true } } },
          },
        },
      },
    },
  },
  variations: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      previousEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true, createdAt: true } },
      variationEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true, createdAt: true } },
      reviewedBy: { select: { role: true } },
      milestone: { select: { id: true, name: true, description: true } },
      resolutions: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { resolvedBy: { select: { role: true } } } },
      evidence: { select: { id: true, currentVersionId: true, sha256: true } },
    },
  },
  blockchainEvents: {
    where: { eventType: { in: [BlockchainEventType.VERIFICATION, BlockchainEventType.ATTESTATION, BlockchainEventType.CORRECTION, BlockchainEventType.DISPUTE, BlockchainEventType.RESOLUTION, BlockchainEventType.VARIATION] } },
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
type MilestoneHistoryRow = Prisma.MilestoneStatusHistoryGetPayload<Record<string, never>>;
export type PassportProjectWithHistory = Omit<PassportProjectRow, "milestones"> & {
  lifecycleHistory: Prisma.ProjectStatusHistoryGetPayload<Record<string, never>>[];
  milestones: (Omit<PassportProjectRow["milestones"][number], "statusHistory"> & {
    statusHistory: MilestoneHistoryRow[];
  })[];
};

async function withProjectLifecycleHistory(
  rows: PassportProjectRow[],
): Promise<PassportProjectWithHistory[]> {
  if (rows.length === 0) return [];
  const projectIds = rows.map((row) => row.id);
  const milestoneIds = rows.flatMap((row) => row.milestones.map((milestone) => milestone.id));
  const [history, milestoneHistory] = await Promise.all([
    prisma.projectStatusHistory.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ sequence: "asc" }],
    }),
    prisma.milestoneStatusHistory.findMany({
      where: { milestoneId: { in: milestoneIds } },
      orderBy: [{ sequence: "asc" }],
    }),
  ]);
  const historyByProject = new Map<string, typeof history>();
  const historyByMilestone = new Map<string, typeof milestoneHistory>();
  for (const entry of history) {
    const projectHistory = historyByProject.get(entry.projectId) ?? [];
    projectHistory.push(entry);
    historyByProject.set(entry.projectId, projectHistory);
  }
  for (const entry of milestoneHistory) {
    const milestoneRows = historyByMilestone.get(entry.milestoneId) ?? [];
    milestoneRows.push(entry);
    historyByMilestone.set(entry.milestoneId, milestoneRows);
  }
  return rows.map((row) => ({
    ...row,
    milestones: row.milestones.map((milestone) => ({
      ...milestone,
      statusHistory: historyByMilestone.get(milestone.id) ?? [],
    })),
    lifecycleHistory: historyByProject.get(row.id) ?? [],
  }));
}

/**
 * Contractor-level Passport projection.
 *
 * Deliberately narrower than the project Passport: it carries counted, factual
 * outcomes per project and milestone and never carries free-text reasons,
 * comment bodies, file names, storage references or uploader identities. That
 * keeps a contractor's accumulated history legible to a CLIENT evaluating them
 * without turning it into a copy of another client's project records.
 */
const contractorPassportInclude = {
  user: {
    select: { id: true, fullName: true, role: true, createdAt: true },
  },
  crbVerifications: {
    orderBy: [{ checkedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      registrationReference: true,
      status: true,
      source: true,
      registrationNumber: true,
      registeredName: true,
      category: true,
      registrationClass: true,
      registrationDate: true,
      expiryDate: true,
      externalReference: true,
      checkedAt: true,
      canonicalDigest: true,
      failureCode: true,
      requestedById: true,
    },
  },
  projects: {
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    include: {
      client: { select: { id: true, fullName: true } },
      milestones: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          corrections: { select: { status: true } },
          disputes: { select: { status: true } },
          evidence: {
            select: {
              status: true,
              attestations: { select: { decision: true } },
              versions: {
                select: {
                  verifications: { select: { status: true } },
                },
              },
            },
          },
        },
      },
      blockchainEvents: {
        where: {
          eventType: {
            in: [
              BlockchainEventType.VERIFICATION,
              BlockchainEventType.ATTESTATION,
              BlockchainEventType.CORRECTION,
              BlockchainEventType.DISPUTE,
              BlockchainEventType.RESOLUTION,
              BlockchainEventType.VARIATION,
            ],
          },
        },
        select: { id: true, txHash: true, blockNumber: true },
      },
    },
  },
} satisfies Prisma.ContractorInclude;

export type ContractorPassportRow = Prisma.ContractorGetPayload<{
  include: typeof contractorPassportInclude;
}>;

export const contractorPassportRepository = {
  findByContractorId(contractorId: string): Promise<ContractorPassportRow | null> {
    return prisma.contractor.findUnique({
      where: { id: contractorId },
      include: contractorPassportInclude,
    });
  },

  findByUserId(userId: string): Promise<ContractorPassportRow | null> {
    return prisma.contractor.findUnique({
      where: { userId },
      include: contractorPassportInclude,
    });
  },

  listProjectStatusHistory(projectIds: string[]) {
    return prisma.projectStatusHistory.findMany({
      where: { projectId: { in: projectIds } },
      orderBy: [{ sequence: "asc" }],
    });
  },

  listMilestoneStatusHistory(milestoneIds: string[]) {
    return prisma.milestoneStatusHistory.findMany({
      where: { milestoneId: { in: milestoneIds } },
      orderBy: [{ sequence: "asc" }],
    });
  },
};

export const passportRepository = {
  async findAccessible(where: Prisma.ProjectWhereInput): Promise<PassportProjectWithHistory[]> {
    const rows = await prisma.project.findMany({
      where,
      include: passportInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return withProjectLifecycleHistory(rows);
  },

  async findById(projectId: string): Promise<PassportProjectWithHistory | null> {
    const row = await prisma.project.findUnique({
      where: { id: projectId },
      include: passportInclude,
    });
    if (!row) return null;
    const [withHistory] = await withProjectLifecycleHistory([row]);
    return withHistory;
  },
};
