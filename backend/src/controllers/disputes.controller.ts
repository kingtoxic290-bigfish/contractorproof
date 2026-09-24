import type { Dispute } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { requireUuid } from "../services/evidence/validation";
import { disputeListWhere } from "../services/access.service";
import { disputeService } from "../services/dispute.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

function toHttpDispute(row: Dispute) {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    raisedById: row.raisedById,
    status: row.status,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createDispute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = String(req.body?.milestoneId ?? "").trim();
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";

    if (!milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
    }
    requireUuid(milestoneId, "milestoneId");
    if (!reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    }

    // raisedById / actorId / userId / status / evidenceId / originalEventId are ignored.
    const row = await disputeService.create({
      actor,
      milestoneId,
      reason,
    });
    sendData(res, { dispute: toHttpDispute(row) }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listDisputes(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId =
      typeof req.query.milestoneId === "string" ? req.query.milestoneId.trim() : undefined;
    const projectId =
      typeof req.query.projectId === "string" ? req.query.projectId.trim() : undefined;
    if (milestoneId) {
      requireUuid(milestoneId, "milestoneId");
    }
    if (projectId) {
      requireUuid(projectId, "projectId");
    }

    const rows = await disputeService.listAccessible(
      disputeListWhere(actor, {
        milestoneId: milestoneId || undefined,
        projectId: projectId || undefined,
      }),
    );
    sendData(res, { disputes: rows.map(toHttpDispute) });
  } catch (error) {
    next(error);
  }
}
