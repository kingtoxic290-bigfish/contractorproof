import type { Correction } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { correctionListWhere } from "../services/access.service";
import { correctionService } from "../services/correction.service";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

function toHttpCorrection(row: Correction) {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    originalEventId: row.originalEventId,
    evidenceId: row.evidenceId,
    actorId: row.actorId,
    reason: row.reason,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createCorrection(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = String(req.body?.milestoneId ?? "").trim();
    const originalEventId = String(req.body?.originalEventId ?? "").trim();
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const evidenceRaw =
      typeof req.body?.evidenceId === "string" ? req.body.evidenceId.trim() : "";

    if (!milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
    }
    if (!originalEventId) {
      throw new ApiError(400, "VALIDATION_ERROR", "originalEventId is required");
    }
    requireUuid(milestoneId, "milestoneId");
    requireUuid(originalEventId, "originalEventId");
    if (evidenceRaw) {
      requireUuid(evidenceRaw, "evidenceId");
    }
    if (!reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    }

    // actorId / userId / role / status / decision are ignored.
    const row = await correctionService.create({
      actor,
      milestoneId,
      originalEventId,
      reason,
      evidenceId: evidenceRaw || undefined,
    });
    sendData(res, { correction: toHttpCorrection(row) }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listCorrections(
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

    const rows = await correctionService.listAccessible(
      correctionListWhere(actor, {
        milestoneId: milestoneId || undefined,
        projectId: projectId || undefined,
      }),
    );
    sendData(res, { corrections: rows.map(toHttpCorrection) });
  } catch (error) {
    next(error);
  }
}
