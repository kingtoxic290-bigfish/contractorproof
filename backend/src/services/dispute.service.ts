import { DisputeStatus, type Dispute, type Prisma } from "@prisma/client";
import { ApiError } from "../http/errors";
import { prisma } from "../repositories/prisma";
import type { PublicUser } from "../types";
import { assertCanWriteMilestone } from "./access.service";

export const disputeService = {
  async create(input: { actor: PublicUser; milestoneId: string; reason: string }): Promise<Dispute> {
    const reason = input.reason.trim();
    if (!reason) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    }

    await assertCanWriteMilestone(input.actor, input.milestoneId);

    return prisma.dispute.create({
      data: {
        milestoneId: input.milestoneId,
        raisedById: input.actor.id,
        reason,
        status: DisputeStatus.OPEN,
      },
    });
  },

  listAccessible(where: Prisma.DisputeWhereInput): Promise<Dispute[]> {
    return prisma.dispute.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },
};
