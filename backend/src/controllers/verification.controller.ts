import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { toHttpVerification } from "../http/evidenceMapper";
import { readBodyField } from "../http/multipart";
import { assertCanCreateVerification } from "../services/access.service";
import { verificationService } from "../services/evidence";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

export async function createVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const evidenceId = readBodyField(req, "evidenceId");
    const evidenceVersionId = readBodyField(req, "evidenceVersionId");
    if (!evidenceId && !evidenceVersionId) {
      throw new ApiError(400, "VALIDATION_ERROR", "evidenceId or evidenceVersionId is required");
    }
    if (evidenceId) {
      requireUuid(evidenceId, "evidenceId");
    }
    if (evidenceVersionId) {
      requireUuid(evidenceVersionId, "evidenceVersionId");
    }

    await assertCanCreateVerification(actor, { evidenceId, evidenceVersionId });

    const presentedBytes = req.file?.buffer;
    const result = presentedBytes
      ? await verificationService.compare({
          presentedBytes,
          evidenceId,
          evidenceVersionId,
          source: "INTERNAL",
          requestedById: actor.id,
        })
      : await verificationService.compareStored({
          evidenceId,
          evidenceVersionId,
          source: "INTERNAL",
          requestedById: actor.id,
        });

    sendData(res, { verification: toHttpVerification(result) });
  } catch (error) {
    next(error);
  }
}
