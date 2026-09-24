import type { VerificationSource, VerificationStatus } from "@prisma/client";
import { prisma } from "./prisma";
import { normalizeSha256 } from "./sha256";

export const verificationRepository = {
  create(input: {
    evidenceVersionId: string;
    status: VerificationStatus;
    presentedSha256?: string | null;
    authoritativeSha256: string;
    source: VerificationSource;
    requestedById?: string | null;
  }) {
    return prisma.verification.create({
      data: {
        evidenceVersionId: input.evidenceVersionId,
        status: input.status,
        presentedSha256:
          input.presentedSha256 == null || input.presentedSha256 === ""
            ? null
            : normalizeSha256(input.presentedSha256),
        authoritativeSha256: normalizeSha256(input.authoritativeSha256),
        source: input.source,
        requestedById: input.requestedById ?? null,
      },
    });
  },

  findById(id: string) {
    return prisma.verification.findUnique({
      where: { id },
    });
  },

  findByEvidenceVersionId(evidenceVersionId: string) {
    return prisma.verification.findMany({
      where: { evidenceVersionId },
      orderBy: { createdAt: "asc" },
    });
  },
};
