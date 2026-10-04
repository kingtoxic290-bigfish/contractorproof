import { MilestoneStatus, ProjectLifecycleStatus, Role } from "@prisma/client";
import { ApiError } from "../http/errors";
import { prisma } from "../repositories/prisma";
import type { PublicUser } from "../types";
import { assertCanReadProject } from "./access.service";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const nextStatus: Record<ProjectLifecycleStatus, ProjectLifecycleStatus | null> = {
  CREATED: ProjectLifecycleStatus.IN_PROGRESS,
  IN_PROGRESS: ProjectLifecycleStatus.EXECUTION_COMPLETE,
  EXECUTION_COMPLETE: ProjectLifecycleStatus.UNDER_FINAL_REVIEW,
  UNDER_FINAL_REVIEW: ProjectLifecycleStatus.COMPLETED,
  COMPLETED: null,
};

function forbidden(): never {
  throw new ApiError(403, "FORBIDDEN", "insufficient permission");
}

function lifecycleEntryView(row: {
  id: string;
  projectId: string;
  sequence: number;
  previousStatus: ProjectLifecycleStatus | null;
  newStatus: ProjectLifecycleStatus;
  actorName: string | null;
  actorRole: Role | null;
  isBaseline: boolean;
  reason: string | null;
  createdAt: Date;
}) {
  return {
    id: row.id,
    projectId: row.projectId,
    sequence: row.sequence,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    actorName: row.actorName,
    actorRole: row.actorRole,
    isBaseline: row.isBaseline,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export const projectLifecycleService = {
  async listHistory(actor: PublicUser, projectId: string) {
    if (!UUID_PATTERN.test(projectId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "projectId must be a valid UUID");
    }
    await assertCanReadProject(actor, projectId);
    const rows = await prisma.projectStatusHistory.findMany({
      where: { projectId },
      orderBy: [{ sequence: "asc" }],
    });
    return rows.map(lifecycleEntryView);
  },

  async transition(
    actor: PublicUser,
    projectId: string,
    input: { status?: unknown; reason?: unknown },
  ) {
    if (!UUID_PATTERN.test(projectId)) {
      throw new ApiError(400, "VALIDATION_ERROR", "projectId must be a valid UUID");
    }
    if (
      typeof input.status !== "string" ||
      !Object.values(ProjectLifecycleStatus).includes(input.status as ProjectLifecycleStatus)
    ) {
      throw new ApiError(400, "VALIDATION_ERROR", "status is invalid");
    }
    const newStatus = input.status as ProjectLifecycleStatus;
    if (input.reason !== undefined && input.reason !== null && typeof input.reason !== "string") {
      throw new ApiError(400, "VALIDATION_ERROR", "reason must be a string");
    }
    const reason = typeof input.reason === "string" ? input.reason.trim() || null : null;
    if (reason && reason.length > 2000) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason must be 2000 characters or fewer");
    }

    return prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{
        id: string;
        lifecycleStatus: ProjectLifecycleStatus;
        clientId: string | null;
        contractorUserId: string;
      }>>`
        SELECT project."id", project."lifecycleStatus", project."clientId",
               contractor."userId" AS "contractorUserId"
        FROM "Project" AS project
        INNER JOIN "Contractor" AS contractor ON contractor."id" = project."contractorId"
        WHERE project."id" = ${projectId}
        FOR UPDATE OF project
      `;
      const project = locked[0];
      if (!project) throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");

      const isAdmin = actor.role === Role.ADMIN;
      const isOwner = actor.role === Role.CLIENT && project.clientId === actor.id;
      const isAssignedContractor = actor.role === Role.CONTRACTOR && project.contractorUserId === actor.id;
      const expected = nextStatus[project.lifecycleStatus];
      if (!expected || newStatus !== expected) {
        throw new ApiError(
          409,
          "CONFLICT",
          expected
            ? `project cannot transition from ${project.lifecycleStatus} to ${newStatus}`
            : "project is already formally completed",
        );
      }

      if (newStatus === ProjectLifecycleStatus.IN_PROGRESS) {
        if (!isAdmin && !isOwner && !isAssignedContractor) forbidden();
      } else if (!isAdmin && !isOwner) {
        forbidden();
      }

      if (newStatus === ProjectLifecycleStatus.EXECUTION_COMPLETE) {
        const milestones = await tx.milestone.findMany({
          where: { projectId },
          select: { status: true },
        });
        if (milestones.length === 0 || milestones.some((milestone) => milestone.status !== MilestoneStatus.VERIFIED)) {
          throw new ApiError(
            409,
            "CONFLICT",
            "execution can be completed only when the project has milestones and all are VERIFIED",
          );
        }
      }

      const updated = await tx.project.update({
        where: { id: projectId },
        data: { lifecycleStatus: newStatus },
      });
      const latestHistory = await tx.projectStatusHistory.findFirst({
        where: { projectId },
        orderBy: { sequence: "desc" },
        select: { sequence: true },
      });
      const history = await tx.projectStatusHistory.create({
        data: {
          projectId,
          sequence: (latestHistory?.sequence ?? -1) + 1,
          previousStatus: project.lifecycleStatus,
          newStatus,
          actorId: actor.id,
          actorName: actor.fullName,
          actorRole: actor.role,
          reason,
        },
      });
      return {
        project: { id: updated.id, lifecycleStatus: updated.lifecycleStatus },
        historyEntry: lifecycleEntryView(history),
      };
    });
  },
};
