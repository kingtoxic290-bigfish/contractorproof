import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { toHttpEvidence } from "../http/evidenceMapper";
import { readBodyField, uploadedOriginalName } from "../http/multipart";
import { assertCanWriteMilestone, evidenceListWhere } from "../services/access.service";
import { evidenceService } from "../services/evidence";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

function requireFile(req: Request) {
  if (!req.file || !req.file.buffer) {
    throw new ApiError(400, "FILE_EMPTY", "file is required");
  }
  return req.file;
}

export async function createEvidence(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const file = requireFile(req);
    const milestoneId = readBodyField(req, "milestoneId");
    if (!milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
    }
    requireUuid(milestoneId, "milestoneId");
    await assertCanWriteMilestone(actor, milestoneId);
    const created = await evidenceService.create({
      milestoneId,
      uploadedById: actor.id,
      originalName: uploadedOriginalName(file),
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    sendData(res, { evidence: toHttpEvidence(created) }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listEvidence(
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
    const rows = await evidenceService.listAccessible(
      evidenceListWhere(actor, {
        milestoneId: milestoneId || undefined,
        projectId: projectId || undefined,
      }),
    );
    sendData(res, { evidence: rows.map(toHttpEvidence) });
  } catch (error) {
    next(error);
  }
}
