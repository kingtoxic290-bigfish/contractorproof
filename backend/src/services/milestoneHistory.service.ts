import { AttestationDecision, MilestoneStatus, Role } from "@prisma/client";
import { ApiError } from "../http/errors";
import { projectRepository } from "../repositories/project.repository";
import { prisma } from "../repositories/prisma";
import type { PublicUser } from "../types";
import { assertCanReadMilestone } from "./access.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const allowedTransitions: Record<MilestoneStatus, readonly MilestoneStatus[]> = {
  PENDING: [MilestoneStatus.IN_PROGRESS],
  IN_PROGRESS: [MilestoneStatus.PENDING_VERIFICATION],
  PENDING_VERIFICATION: [MilestoneStatus.VERIFIED, MilestoneStatus.REJECTED],
  REJECTED: [MilestoneStatus.IN_PROGRESS],
  VERIFIED: [],
};

function deny(): never {
  throw new ApiError(403, "FORBIDDEN", "insufficient permission");
}

function toHistoryView(row: {
  id: string;
  milestoneId: string;
  sequence: number;
  previousStatus: MilestoneStatus | null;
  newStatus: MilestoneStatus;
  actorName: string | null;
  actorRole: Role | null;
  evidenceId: string | null;
  isBaseline: boolean;
  reason: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    sequence: row.sequence,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actorName: row.actorName,
    actorRole: row.actorRole,
    evidenceId: row.evidenceId,
    isBaseline: row.isBaseline,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export const milestoneHistoryService = {
  /**
   * Append-only milestone status history, oldest first.
   *
   * The baseline entry written when the milestone was created has a null
   * previousStatus. Nothing is derived or summarised here: this is the record
   * of how a milestone reached its current status, not a progress percentage,
   * a completion state, or any judgement about the contractor.
   */
  async list(actor: PublicUser, milestoneId: string) {
    if (!UUID_PATTERN.test(milestoneId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId must be a valid UUID");
    }
    // Same gate as GET /milestones/:id, so history is never more visible than
    // the milestone it describes.
    await assertCanReadMilestone(actor, milestoneId);
    const rows = await projectRepository.listMilestoneStatusHistory(milestoneId);
    return rows.map(toHistoryView);
  },

  async transition(
    actor: PublicUser,
    milestoneId: string,
    input: { status?: unknown; evidenceId?: unknown; reason?: unknown },
  ) {
    if (!UUID_PATTERN.test(milestoneId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId must be a valid UUID");
    }

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: string;
        projectId: string;
        status: MilestoneStatus;
        policyId: string | null;
        clientId: string | null;
        contractorUserId: string;
      }>>`
        SELECT milestone."id", milestone."projectId", milestone."status", milestone."policyId",
               project."clientId", contractor."userId" AS "contractorUserId"
        FROM "Milestone" AS milestone
        INNER JOIN "Project" AS project ON project."id" = milestone."projectId"
        INNER JOIN "Contractor" AS contractor ON contractor."id" = project."contractorId"
        WHERE milestone."id" = ${milestoneId}
        FOR UPDATE OF milestone, project
      `;
      const current = locked[0];
      if (!current) {
        throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
      }

      // Authorization runs before any request-shape or business validation.
      //
      // An actor with no standing on this milestone gets 403 regardless of how
      // malformed or impossible the rest of the request is. Validating first
      // would let a caller probe the request's shape and the milestone's state
      // using 400s that only an authorized actor should be able to elicit, and
      // it would answer "you are forbidden" as "that transition is not legal",
      // which points the caller at the wrong fix.
      const isAdmin = actor.role === Role.ADMIN;
      const isOwner = actor.role === Role.CLIENT && current.clientId === actor.id;
      const isAssignedContractor = actor.role === Role.CONTRACTOR && current.contractorUserId === actor.id;
      if (!isAdmin && !isOwner && !isAssignedContractor) deny();

      if (typeof input.status !== "string" || !Object.values(MilestoneStatus).includes(input.status as MilestoneStatus)) {
        throw new ApiError(400, "VALIDATION_ERROR", "status is invalid");
      }
      const newStatus = input.status as MilestoneStatus;
      const evidenceId = input.evidenceId === undefined || input.evidenceId === null || input.evidenceId === ""
        ? null
        : typeof input.evidenceId === "string" && UUID_PATTERN.test(input.evidenceId)
          ? input.evidenceId
          : null;
      // Which transitions a role may drive at all. Checked before the request is
      // validated any further and before the transition is judged legal: a
      // CONTRACTOR asking to VERIFY is told it is forbidden to verify, not that
      // its evidenceId was malformed and not that PENDING cannot reach VERIFIED.
      // The status has to be readable to reach this point, but nothing else in
      // the body has been trusted yet.
      if (newStatus === MilestoneStatus.PENDING_VERIFICATION && !isAdmin && !isAssignedContractor) {
        deny();
      }
      if (
        (newStatus === MilestoneStatus.VERIFIED || newStatus === MilestoneStatus.REJECTED) &&
        !isAdmin && !isOwner
      ) {
        deny();
      }

      if (input.evidenceId !== undefined && input.evidenceId !== null && input.evidenceId !== "" && !evidenceId) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidenceId must be a valid UUID");
      }
      if (input.reason !== undefined && input.reason !== null && typeof input.reason !== "string") {
        throw new ApiError(400, "VALIDATION_ERROR", "reason must be a string");
      }
      const reason = typeof input.reason === "string" ? input.reason.trim() || null : null;
      if (reason && reason.length > 2000) {
        throw new ApiError(400, "VALIDATION_ERROR", "reason must be 2000 characters or fewer");
      }

      const requiresEvidence = ([
        MilestoneStatus.PENDING_VERIFICATION,
        MilestoneStatus.VERIFIED,
        MilestoneStatus.REJECTED,
      ] as MilestoneStatus[]).includes(newStatus);
      if (requiresEvidence && !evidenceId) {
        throw new ApiError(400, "VALIDATION_ERROR", "evidenceId is required for submission and review transitions");
      }

      if (!allowedTransitions[current.status].includes(newStatus)) {
        throw new ApiError(
          409,
          "CONFLICT",
          `milestone cannot transition from ${current.status} to ${newStatus}`,
        );
      }

      if (evidenceId) {
        const evidence = await tx.evidence.findUnique({
          where: { id: evidenceId },
          select: { id: true, milestoneId: true },
        });
        if (!evidence) throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
        if (evidence.milestoneId !== milestoneId) {
          throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to milestone");
        }
      }

      if (newStatus === MilestoneStatus.VERIFIED || newStatus === MilestoneStatus.REJECTED) {
        const decision = newStatus === MilestoneStatus.VERIFIED
          ? AttestationDecision.APPROVED
          : AttestationDecision.REJECTED;
        const attestations = await tx.attestation.findMany({
          where: { milestoneId, evidenceId: evidenceId!, decision },
          distinct: ["verifierId"],
          select: { verifierId: true },
        });
        const policy = current.policyId
          ? await tx.verificationPolicy.findUnique({
              where: { id: current.policyId },
              select: { requiredApprovals: true },
            })
          : null;
        const required = newStatus === MilestoneStatus.VERIFIED
          ? policy?.requiredApprovals ?? 1
          : 1;
        if (attestations.length < required) {
          throw new ApiError(
            409,
            "CONFLICT",
            `milestone requires ${required} ${decision.toLowerCase()} attestation(s) for this evidence`,
          );
        }
      }

      const updated = await tx.milestone.update({
        where: { id: milestoneId },
        data: { status: newStatus },
      });
      const latestHistory = await tx.milestoneStatusHistory.findFirst({
        where: { milestoneId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const historyRow = await tx.milestoneStatusHistory.create({
        data: {
          milestoneId,
          sequence: (latestHistory?.sequence ?? -1) + 1,
          previousStatus: current.status,
          newStatus,
          actorId: actor.id,
          actorName: actor.fullName,
          actorRole: actor.role,
          evidenceId,
          reason,
        },
      });
      return {
        milestone: { id: updated.id, projectId: updated.projectId, status: updated.status },
        historyEntry: toHistoryView(historyRow),
      };
    });
  },
};
