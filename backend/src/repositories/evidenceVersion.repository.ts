import { prisma } from "./prisma";

export const evidenceVersionRepository = {
  findById(id: string) {
    return prisma.evidenceVersion.findUnique({
      where: { id },
    });
  },

  findByEvidenceId(evidenceId: string) {
    return prisma.evidenceVersion.findMany({
      where: { evidenceId },
      orderBy: { versionNumber: "asc" },
    });
  },

  findByEvidenceAndSha256(evidenceId: string, sha256: string) {
    return prisma.evidenceVersion.findUnique({
      where: {
        evidenceId_sha256: {
          evidenceId,
          sha256,
        },
      },
    });
  },
};
