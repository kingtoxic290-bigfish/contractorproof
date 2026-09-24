import type { Correction, Prisma } from "@prisma/client";
import { ApiError } from "../http/errors";
import { evidenceRepository } from "../repositories/evidence.repository";
import { prisma } from "../repositories/prisma";
import { projectRepository } from "../repositories/project.repository";
import type { PublicUser } from "../types";
import { assertCanWriteMilestone } from "./access.service";

export const correctionService = {
  async create(input: {
    actor: PublicUser;
    milestoneId: string;
    originalEventId: string;
    reason: string;
    evidenceId?: string;
  }): Promise<Correction> {
    const reason = input.reason.trim();
    if (!reason) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    }

    await assertCanWriteMilestone(input.actor, input.milestoneId);

    const milestone = await projectRepository.getMilestoneById(input.milestoneId);
    if (!milestone) {
      throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
    }

    const originalEvent = await prisma.blockchainEvent.findUnique({
      where: { id: input.originalEventId },
    });
    if (!originalEvent) {
      throw new ApiError(404, "EVENT_NOT_FOUND", "original event not found");
    }
    if (originalEvent.projectId !== milestone.projectId) {
      throw new ApiError(
        400,
        "VALIDATION_ERROR",
        "original event does not belong to the milestone project",
      );
    }

    let evidenceId: string | null = null;
    if (input.evidenceId) {
      const evidence = await evidenceRepository.findById(input.evidenceId);
      if (!evidence) {
        throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
      }
      if (evidence.milestoneId !== milestone.id) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to milestone");
      }
      evidenceId = evidence.id;
    }

    return prisma.correction.create({
      data: {
        milestoneId: milestone.id,
        originalEventId: originalEvent.id,
        reason,
        evidenceId,
        actorId: input.actor.id,
      },
    });
  },

  listAccessible(where: Prisma.CorrectionWhereInput): Promise<Correction[]> {
    return prisma.correction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },
};
