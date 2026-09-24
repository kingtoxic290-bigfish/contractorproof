import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { readBodyField } from "../http/multipart";
import { verificationService } from "../services/evidence";

export async function createPublicVerification(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.file?.buffer || req.file.buffer.length === 0) {
      throw new ApiError(400, "FILE_EMPTY", "file is required");
    }
    const evidenceId = readBodyField(req, "evidenceId");
    const evidenceVersionId = readBodyField(req, "evidenceVersionId");
    if (!evidenceId && !evidenceVersionId) {
      throw new ApiError(400, "VALIDATION_ERROR", "evidenceId or evidenceVersionId is required");
    }

    const result = await verificationService.comparePublic({
      presentedBytes: req.file.buffer,
      evidenceId,
      evidenceVersionId,
    });

    sendData(res, {
      verification: {
        status: result.status,
        evidenceVersionId: result.evidenceVersionId,
        meaning: result.meaning,
      },
    });
  } catch (error) {
    next(error);
  }
}
