import { BlockchainEventType, CorrectionStatus, Role, type Prisma } from "@prisma/client";
import { ApiError } from "../http/errors";
import { blockchainEventRepository } from "../repositories/blockchainEvent.repository";
import { evidenceRepository } from "../repositories/evidence.repository";
import { prisma } from "../repositories/prisma";
import { projectRepository } from "../repositories/project.repository";
import type { PublicUser } from "../types";
import { assertCanReadProject, assertCanWriteMilestone } from "./access.service";
import { proofService, type ProofView } from "./proof.service";

const correctionInclude = {
  milestone: { select: { id: true, projectId: true } },
  originalEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true } },
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
  correctionEvent: { select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true } },
  resolutions: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: {
      resolvedBy: { select: { id: true, role: true } },
      correctedEvidenceVersion: {
        select: { id: true, evidenceId: true, versionNumber: true, sha256: true, createdAt: true },
      },
    },
  },
} satisfies Prisma.CorrectionInclude;

export type CorrectionRecord = Prisma.CorrectionGetPayload<{ include: typeof correctionInclude }>;

const RESOLVER_ROLES: Role[] = [Role.ADMIN, Role.AUDITOR, Role.PROCUREMENT_OFFICER];

function normalizeText(text: string, field: string): string {
  const value = text.trim();
  if (!value) throw new ApiError(400, "VALIDATION_ERROR", `${field} is required`);
  return value;
}

function requireResolver(actor: PublicUser): void {
  if (!RESOLVER_ROLES.includes(actor.role)) {
    throw new ApiError(403, "FORBIDDEN", "insufficient permission");
  }
}

async function loadCorrection(id: string): Promise<CorrectionRecord> {
  const correction = await prisma.correction.findUnique({ where: { id }, include: correctionInclude });
  if (!correction) throw new ApiError(404, "CORRECTION_NOT_FOUND", "correction not found");
  return correction;
}

async function proofForCorrection(correction: CorrectionRecord): Promise<ProofView | null> {
  if (!correction.correctionEventId) return null;
  const event = await blockchainEventRepository.findById(correction.correctionEventId);
  return event ? proofService.toProofView(event) : null;
}

export const correctionService = {
  async create(input: {
    actor: PublicUser;
    milestoneId: string;
    originalEventId: string;
    reason: string;
    evidenceId?: string;
  }): Promise<CorrectionRecord> {
    const reason = normalizeText(input.reason, "reason");
    // Authorize before looking up caller-controlled event/evidence identifiers.
    await assertCanWriteMilestone(input.actor, input.milestoneId);
    const milestone = await projectRepository.getMilestoneById(input.milestoneId);
    if (!milestone) throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");

    const originalEvent = await blockchainEventRepository.findById(input.originalEventId);
    if (!originalEvent) throw new ApiError(404, "EVENT_NOT_FOUND", "original event not found");
    if (originalEvent.projectId !== milestone.projectId) {
      throw new ApiError(400, "VALIDATION_ERROR", "original event does not belong to milestone project");
    }

    let originalEvidenceVersionId: string | null = null;
    if (originalEvent.eventType === BlockchainEventType.VERIFICATION) {
      const version = originalEvent.referenceId
        ? await prisma.evidenceVersion.findUnique({ where: { id: originalEvent.referenceId } })
        : null;
      if (!version) {
        throw new ApiError(400, "VALIDATION_ERROR", "verification event does not reference an evidence version");
      }
      const originalEvidence = await evidenceRepository.findById(version.evidenceId);
      if (!originalEvidence || originalEvidence.milestoneId !== milestone.id) {
        throw new ApiError(400, "VALIDATION_ERROR", "original evidence version does not belong to milestone");
      }
      originalEvidenceVersionId = version.id;
    }

    if (input.evidenceId) {
      const evidence = await evidenceRepository.findById(input.evidenceId);
      if (!evidence) throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
      if (evidence.milestoneId !== milestone.id) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to milestone");
      }
    }

    const row = await prisma.correction.create({
      data: {
        milestoneId: milestone.id,
        originalEventId: originalEvent.id,
        originalEvidenceVersionId,
        reason,
        evidenceId: input.evidenceId ?? null,
        actorId: input.actor.id,
        status: CorrectionStatus.OPEN,
      },
      include: correctionInclude,
    });
    return row;
  },

  async getById(actor: PublicUser, id: string): Promise<{ correction: CorrectionRecord; blockchainProof: ProofView | null }> {
    const correction = await loadCorrection(id);
    await assertCanReadProject(actor, correction.milestone.projectId);
    return { correction, blockchainProof: await proofForCorrection(correction) };
  },

  listAccessible(where: Prisma.CorrectionWhereInput): Promise<CorrectionRecord[]> {
    return prisma.correction.findMany({
      where,
      include: correctionInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  async markUnderReview(actor: PublicUser, id: string): Promise<CorrectionRecord> {
    requireResolver(actor);
    const correction = await loadCorrection(id);
    await assertCanReadProject(actor, correction.milestone.projectId);
    if (correction.status === CorrectionStatus.UNDER_REVIEW) return correction;
    if (correction.status !== CorrectionStatus.OPEN) {
      throw new ApiError(409, "CONFLICT", "only an open correction can enter review");
    }
    await prisma.correction.update({ where: { id }, data: { status: CorrectionStatus.UNDER_REVIEW } });
    return loadCorrection(id);
  },

  async resolve(input: {
    actor: PublicUser;
    correctionId: string;
    status: "APPROVED" | "REJECTED";
    resolution: string;
    correctedEvidenceVersionId?: string;
  }): Promise<{
    correction: CorrectionRecord;
    resolution: CorrectionRecord["resolutions"][number];
    blockchainProof: ProofView | null;
  }> {
    requireResolver(input.actor);
    const resolutionText = normalizeText(input.resolution, "resolution");
    let correction = await loadCorrection(input.correctionId);
    await assertCanReadProject(input.actor, correction.milestone.projectId);

    let correctedVersion = null;
    if (input.correctedEvidenceVersionId) {
      correctedVersion = await prisma.evidenceVersion.findUnique({
        where: { id: input.correctedEvidenceVersionId },
      });
      if (!correctedVersion) throw new ApiError(404, "VERSION_NOT_FOUND", "corrected evidence version not found");
      const expectedEvidenceId = correction.evidenceId ?? correction.originalEvidenceVersion?.evidenceId ?? null;
      if (!expectedEvidenceId || correctedVersion.evidenceId !== expectedEvidenceId) {
        throw new ApiError(400, "VALIDATION_ERROR", "corrected version does not belong to linked evidence");
      }
      if (correctedVersion.id === correction.originalEvidenceVersionId) {
        throw new ApiError(400, "VALIDATION_ERROR", "corrected version must differ from original version");
      }
      if (
        correction.originalEvidenceVersion &&
        correctedVersion.evidenceId === correction.originalEvidenceVersion.evidenceId &&
        correctedVersion.versionNumber <= correction.originalEvidenceVersion.versionNumber
      ) {
        throw new ApiError(400, "VALIDATION_ERROR", "corrected version must follow the original version");
      }
    }
    if (input.status === "APPROVED" && correction.originalEvidenceVersionId && !correctedVersion) {
      throw new ApiError(400, "VALIDATION_ERROR", "approved evidence correction requires a corrected version");
    }
    if (input.status === "REJECTED" && correctedVersion) {
      throw new ApiError(400, "VALIDATION_ERROR", "rejected correction cannot link a corrected version");
    }

    let resolution = correction.resolutions[0] ?? null;
    if (resolution) {
      if (
        resolution.status !== input.status ||
        resolution.resolution !== resolutionText ||
        resolution.correctedEvidenceVersionId !== (correctedVersion?.id ?? null)
      ) {
        throw new ApiError(409, "CONFLICT", "correction already has a different resolution");
      }
    } else {
      if (correction.status === CorrectionStatus.APPROVED || correction.status === CorrectionStatus.REJECTED) {
        throw new ApiError(409, "CONFLICT", "correction is already closed");
      }
      try {
        resolution = await prisma.$transaction(async (tx) => {
          const current = await tx.correction.findUnique({ where: { id: input.correctionId } });
          if (!current || (current.status !== CorrectionStatus.OPEN && current.status !== CorrectionStatus.UNDER_REVIEW)) {
            throw new ApiError(409, "CONFLICT", "correction is already closed");
          }
          const created = await tx.correctionResolution.create({
            data: {
              correctionId: current.id,
              status: input.status,
              resolution: resolutionText,
              correctedEvidenceVersionId: correctedVersion?.id ?? null,
              resolvedById: input.actor.id,
            },
            include: {
              resolvedBy: { select: { id: true, role: true } },
              correctedEvidenceVersion: { select: { id: true, evidenceId: true, versionNumber: true, sha256: true, createdAt: true } },
            },
          });
          await tx.correction.update({ where: { id: current.id }, data: { status: input.status } });
          return created;
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
          const existing = await prisma.correctionResolution.findUnique({
            where: { correctionId: input.correctionId },
            include: {
              resolvedBy: { select: { id: true, role: true } },
              correctedEvidenceVersion: { select: { id: true, evidenceId: true, versionNumber: true, sha256: true, createdAt: true } },
            },
          });
          if (existing && existing.status === input.status && existing.resolution === resolutionText &&
            existing.correctedEvidenceVersionId === (correctedVersion?.id ?? null)) {
            resolution = existing;
          } else {
            throw new ApiError(409, "CONFLICT", "correction already has a different resolution");
          }
        } else {
          throw error;
        }
      }
      correction = await loadCorrection(input.correctionId);
    }

    if (!resolution) throw new ApiError(500, "INTERNAL_ERROR", "correction resolution was not persisted");
    let blockchainProof = await proofForCorrection(correction);
    const original = correction.originalEvent;
    const hasConfirmedBlockchainProof = Boolean(
      blockchainProof?.txHash && blockchainProof.blockNumber != null && blockchainProof.blockNumber > 0,
    );
    if (
      input.status === "APPROVED" && !hasConfirmedBlockchainProof && correctedVersion &&
      original.txHash && original.blockNumber != null && original.blockNumber > 0
    ) {
      blockchainProof = await proofService.anchorCorrection({
        correctionId: correction.id,
        projectId: correction.milestone.projectId,
        originalEventId: original.id,
        correctedEvidenceHash: correctedVersion.sha256,
        actorId: input.actor.id,
      });
      if (blockchainProof) {
        await prisma.correction.update({ where: { id: correction.id }, data: { correctionEventId: blockchainProof.id } });
        correction = await loadCorrection(correction.id);
      }
    }
    return { correction, resolution, blockchainProof };
  },
};
