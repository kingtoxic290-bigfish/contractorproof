import type { EvidenceStatus, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { RepositoryError } from "./errors";
import { normalizeSha256 } from "./sha256";

export type CreateEvidenceInput = {
  milestoneId: string;
  uploadedById: string;
  fileName: string;
  storageReference: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdById?: string;
};

export type AppendEvidenceVersionInput = {
  evidenceId: string;
  fileName: string;
  storageReference: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  createdById?: string;
};

const versionSelect = {
  id: true,
  evidenceId: true,
  versionNumber: true,
  storageReference: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  sha256: true,
  createdById: true,
  createdAt: true,
} satisfies Prisma.EvidenceVersionSelect;

function currentMetadata(version: {
  id: string;
  fileName: string;
  storageReference: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
}) {
  return {
    currentVersionId: version.id,
    fileName: version.fileName,
    storageKey: version.storageReference,
    mimeType: version.mimeType,
    sizeBytes: version.sizeBytes,
    sha256: version.sha256,
  };
}

export const evidenceRepository = {
  findById(id: string) {
    return prisma.evidence.findUnique({
      where: { id },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: "asc" } },
      },
    });
  },

  findByMilestoneId(milestoneId: string) {
    return prisma.evidence.findMany({
      where: { milestoneId },
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  /**
   * List evidence with access constraints applied in SQL.
   * Callers must pass the full where clause — do not fetch-all then filter.
   */
  findAccessible(where: Prisma.EvidenceWhereInput) {
    return prisma.evidence.findMany({
      where,
      include: {
        currentVersion: true,
        versions: { orderBy: { versionNumber: "asc" } },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  async createWithInitialVersion(input: CreateEvidenceInput) {
    const sha256 = normalizeSha256(input.sha256);
    const createdById = input.createdById ?? input.uploadedById;

    return prisma.$transaction(async (tx) => {
      const evidence = await tx.evidence.create({
        data: {
          milestoneId: input.milestoneId,
          uploadedById: input.uploadedById,
          fileName: input.fileName,
          storageKey: input.storageReference,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256,
          status: "PENDING_VERIFICATION",
        },
      });

      const version = await tx.evidenceVersion.create({
        data: {
          evidenceId: evidence.id,
          versionNumber: 1,
          storageReference: input.storageReference,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256,
          createdById,
        },
        select: versionSelect,
      });

      const current = await tx.evidence.update({
        where: { id: evidence.id },
        data: { currentVersionId: version.id },
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: "asc" } },
        },
      });

      return current;
    });
  },

  async appendVersion(input: AppendEvidenceVersionInput) {
    const sha256 = normalizeSha256(input.sha256);

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Evidence" WHERE id = ${input.evidenceId} FOR UPDATE
      `;
      if (locked.length === 0) {
        throw new RepositoryError("evidence not found");
      }

      const evidence = await tx.evidence.findUnique({
        where: { id: input.evidenceId },
        include: {
          versions: { orderBy: { versionNumber: "desc" }, take: 1 },
        },
      });
      if (!evidence) {
        throw new RepositoryError("evidence not found");
      }

      const nextNumber = (evidence.versions[0]?.versionNumber ?? 0) + 1;
      const version = await tx.evidenceVersion.create({
        data: {
          evidenceId: evidence.id,
          versionNumber: nextNumber,
          storageReference: input.storageReference,
          fileName: input.fileName,
          mimeType: input.mimeType,
          sizeBytes: input.sizeBytes,
          sha256,
          createdById: input.createdById ?? evidence.uploadedById,
        },
        select: versionSelect,
      });

      return tx.evidence.update({
        where: { id: evidence.id },
        data: currentMetadata(version),
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: "asc" } },
        },
      });
    });
  },

  async setCurrentVersion(evidenceId: string, versionId: string) {
    return prisma.$transaction(async (tx) => {
      const version = await tx.evidenceVersion.findUnique({
        where: { id: versionId },
      });
      if (!version || version.evidenceId !== evidenceId) {
        throw new RepositoryError("version does not belong to evidence");
      }

      return tx.evidence.update({
        where: { id: evidenceId },
        data: currentMetadata(version),
        include: {
          currentVersion: true,
          versions: { orderBy: { versionNumber: "asc" } },
        },
      });
    });
  },

  async updateWorkflowStatus(id: string, status: EvidenceStatus) {
    return prisma.evidence.update({
      where: { id },
      data: { status },
    });
  },
};
