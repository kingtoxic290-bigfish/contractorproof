import { BlockchainEventType, DisputeStatus, Role, type Prisma } from "@prisma/client";
import { ApiError } from "../http/errors";
import { blockchainEventRepository } from "../repositories/blockchainEvent.repository";
import { evidenceRepository } from "../repositories/evidence.repository";
import { prisma } from "../repositories/prisma";
import { projectRepository } from "../repositories/project.repository";
import type { PublicUser } from "../types";
import { assertCanReadProject, assertCanWriteMilestone } from "./access.service";
import { proofService, type ProofView } from "./proof.service";

const disputeInclude = {
  milestone: { select: { id: true, projectId: true } },
  resolutions: {
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { resolvedBy: { select: { id: true, role: true } } },
  },
  disputeEvent: {
    select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true },
  },
  originalEvent: {
    select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true },
  },
  resolutionEvent: {
    select: { id: true, eventType: true, referenceId: true, txHash: true, blockNumber: true },
  },
} satisfies Prisma.DisputeInclude;

export type DisputeRecord = Prisma.DisputeGetPayload<{ include: typeof disputeInclude }>;

const RESOLVER_ROLES: Role[] = [Role.ADMIN, Role.AUDITOR, Role.PROCUREMENT_OFFICER];

function requireResolver(actor: PublicUser): void {
  if (!RESOLVER_ROLES.includes(actor.role)) {
    throw new ApiError(403, "FORBIDDEN", "insufficient permission");
  }
}

function normalizeReason(reason: string, field: string): string {
  const value = reason.trim();
  if (!value) {
    throw new ApiError(400, "VALIDATION_ERROR", `${field} is required`);
  }
  return value;
}

async function loadDispute(id: string): Promise<DisputeRecord> {
  const dispute = await prisma.dispute.findUnique({ where: { id }, include: disputeInclude });
  if (!dispute) {
    throw new ApiError(404, "DISPUTE_NOT_FOUND", "dispute not found");
  }
  return dispute;
}

async function proofForDispute(dispute: DisputeRecord): Promise<ProofView | null> {
  if (!dispute.disputeEventId) {
    return null;
  }
  const event = await blockchainEventRepository.findById(dispute.disputeEventId);
  return event ? proofService.toProofView(event) : null;
}

async function proofForResolution(dispute: DisputeRecord): Promise<ProofView | null> {
  if (!dispute.resolutionEventId) {
    return null;
  }
  const event = await blockchainEventRepository.findById(dispute.resolutionEventId);
  return event ? proofService.toProofView(event) : null;
}

export const disputeService = {
  async create(input: {
    actor: PublicUser;
    milestoneId: string;
    reason: string;
    evidenceId?: string;
    originalEventId?: string;
  }): Promise<{ dispute: DisputeRecord; blockchainProof: ProofView | null }> {
    const reason = normalizeReason(input.reason, "reason");

    // Authorization is checked before any caller-supplied evidence/event reference is loaded.
    await assertCanWriteMilestone(input.actor, input.milestoneId);
    const milestone = await projectRepository.getMilestoneById(input.milestoneId);
    if (!milestone) {
      throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
    }

    if (input.evidenceId) {
      const evidence = await evidenceRepository.findById(input.evidenceId);
      if (!evidence) {
        throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
      }
      if (evidence.milestoneId !== milestone.id) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to milestone");
      }
    }

    let originalEvent = null;
    if (input.originalEventId) {
      originalEvent = await blockchainEventRepository.findById(input.originalEventId);
      if (!originalEvent) {
        throw new ApiError(404, "BLOCKCHAIN_EVENT_NOT_FOUND", "original event not found");
      }
      if (originalEvent.projectId !== milestone.projectId) {
        throw new ApiError(400, "VALIDATION_ERROR", "original event does not belong to milestone project");
      }
    }

    const created = await prisma.dispute.create({
      data: {
        milestoneId: milestone.id,
        evidenceId: input.evidenceId ?? null,
        originalEventId: originalEvent?.id ?? null,
        raisedById: input.actor.id,
        reason,
        status: DisputeStatus.OPEN,
      },
    });

    let blockchainProof: ProofView | null = null;
    if (originalEvent?.txHash && originalEvent.blockNumber != null && originalEvent.blockNumber > 0) {
      blockchainProof = await proofService.anchorDispute({
        disputeId: created.id,
        projectId: milestone.projectId,
        originalEventId: originalEvent.id,
        actorId: input.actor.id,
      });
      if (blockchainProof) {
        await prisma.dispute.update({
          where: { id: created.id },
          data: { disputeEventId: blockchainProof.id },
        });
      }
    }

    return { dispute: await loadDispute(created.id), blockchainProof };
  },

  async getById(actor: PublicUser, id: string): Promise<{
    dispute: DisputeRecord;
    blockchainProof: ProofView | null;
    resolutionProof: ProofView | null;
  }> {
    const dispute = await loadDispute(id);
    await assertCanReadProject(actor, dispute.milestone.projectId);
    return {
      dispute,
      blockchainProof: await proofForDispute(dispute),
      resolutionProof: await proofForResolution(dispute),
    };
  },

  async listAccessible(where: Prisma.DisputeWhereInput): Promise<DisputeRecord[]> {
    return prisma.dispute.findMany({
      where,
      include: disputeInclude,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  async markUnderReview(actor: PublicUser, id: string): Promise<DisputeRecord> {
    requireResolver(actor);
    const dispute = await loadDispute(id);
    await assertCanReadProject(actor, dispute.milestone.projectId);
    if (dispute.status === DisputeStatus.UNDER_REVIEW) {
      return dispute;
    }
    if (dispute.status !== DisputeStatus.OPEN) {
      throw new ApiError(409, "CONFLICT", "only an open dispute can enter review");
    }
    await prisma.dispute.update({ where: { id }, data: { status: DisputeStatus.UNDER_REVIEW } });
    return loadDispute(id);
  },

  async resolve(input: {
    actor: PublicUser;
    disputeId: string;
    status: "RESOLVED" | "REJECTED";
    resolution: string;
  }): Promise<{
    dispute: DisputeRecord;
    resolution: DisputeRecord["resolutions"][number];
    blockchainProof: ProofView | null;
  }> {
    requireResolver(input.actor);
    const resolutionText = normalizeReason(input.resolution, "resolution");
    let dispute = await loadDispute(input.disputeId);
    await assertCanReadProject(input.actor, dispute.milestone.projectId);

    let resolution: DisputeRecord["resolutions"][number] | null = dispute.resolutions[0] ?? null;
    if (resolution) {
      if (resolution.status !== input.status || resolution.resolution !== resolutionText) {
        throw new ApiError(409, "CONFLICT", "dispute already has a different resolution");
      }
    } else {
      if (dispute.status === DisputeStatus.RESOLVED || dispute.status === DisputeStatus.REJECTED) {
        throw new ApiError(409, "CONFLICT", "dispute is already closed");
      }
      try {
        resolution = await prisma.$transaction(async (tx) => {
          const current = await tx.dispute.findUnique({ where: { id: input.disputeId } });
          if (!current || (current.status !== DisputeStatus.OPEN && current.status !== DisputeStatus.UNDER_REVIEW)) {
            throw new ApiError(409, "CONFLICT", "dispute is already closed");
          }
          const created = await tx.disputeResolution.create({
            data: {
              disputeId: current.id,
              status: input.status,
              resolution: resolutionText,
              resolvedById: input.actor.id,
            },
            include: { resolvedBy: { select: { id: true, role: true } } },
          });
          await tx.dispute.update({ where: { id: current.id }, data: { status: input.status } });
          return created;
        });
      } catch (error) {
        if (typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002") {
          const existing = await prisma.disputeResolution.findUnique({
            where: { disputeId: input.disputeId },
            include: { resolvedBy: { select: { id: true, role: true } } },
          });
          if (existing && existing.status === input.status && existing.resolution === resolutionText) {
            resolution = existing;
          } else {
            throw new ApiError(409, "CONFLICT", "dispute already has a different resolution");
          }
        } else {
          throw error;
        }
      }
      dispute = await loadDispute(input.disputeId);
    }

    if (!resolution) {
      throw new ApiError(500, "INTERNAL_ERROR", "dispute resolution was not persisted");
    }

    let blockchainProof: ProofView | null = await proofForResolution(dispute);
    if (!blockchainProof && dispute.disputeEventId) {
      const disputeEvent = await blockchainEventRepository.findById(dispute.disputeEventId);
      if (disputeEvent?.txHash && disputeEvent.blockNumber != null && disputeEvent.blockNumber > 0) {
        blockchainProof = await proofService.anchorDisputeResolution({
          resolutionId: resolution.id,
          projectId: dispute.milestone.projectId,
          disputeEventId: disputeEvent.id,
          actorId: input.actor.id,
        });
        if (blockchainProof) {
          await prisma.dispute.update({
            where: { id: dispute.id },
            data: { resolutionEventId: blockchainProof.id },
          });
          dispute = await loadDispute(dispute.id);
        }
      }
    }

    return { dispute, resolution, blockchainProof };
  },
};
