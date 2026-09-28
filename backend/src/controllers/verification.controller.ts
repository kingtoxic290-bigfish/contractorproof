import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { toHttpVerification } from "../http/evidenceMapper";
import { readBodyField } from "../http/multipart";
import { assertCanCreateVerification } from "../services/access.service";
import { verificationApplication } from "../services/verification.application";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

function toHttpProof(
  proof: {
    id: string;
    eventType: string;
    txHash: string | null;
    blockNumber: number | null;
    evidenceHash: string | null;
  } | null,
) {
  if (!proof) {
    return null;
  }
  return {
    id: proof.id,
    eventType: proof.eventType,
    txHash: proof.txHash,
    blockNumber: proof.blockNumber,
    evidenceHash: proof.evidenceHash,
  };
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

    const { verification, proof } = await verificationApplication.createInternal(actor, {
      evidenceId,
      evidenceVersionId,
      presentedBytes: req.file?.buffer,
    });

    sendData(res, {
      verification: toHttpVerification(verification),
      proof: toHttpProof(proof),
    });
  } catch (error) {
    next(error);
  }
}
