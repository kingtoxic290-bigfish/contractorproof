import { AttestationDecision } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { attestationService } from "../services/attestation.service";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

export async function createAttestation(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const evidenceId = String(req.body?.evidenceId ?? "").trim();
    const milestoneId = String(req.body?.milestoneId ?? "").trim();
    const decision = String(req.body?.decision ?? "").trim() as AttestationDecision;
    const comment = typeof req.body?.comment === "string" ? req.body.comment : undefined;

    if (!evidenceId || !milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "evidenceId and milestoneId are required");
    }
    requireUuid(evidenceId, "evidenceId");
    requireUuid(milestoneId, "milestoneId");
    if (decision !== "APPROVED" && decision !== "REJECTED") {
      throw new ApiError(400, "VALIDATION_ERROR", "decision must be APPROVED or REJECTED");
    }

    // verifierId / verifierRole / evidenceVersionId from the body are ignored.
    const row = await attestationService.create({
      actor,
      evidenceId,
      milestoneId,
      decision,
      comment,
    });

    sendData(
      res,
      {
        attestation: {
          id: row.id,
          evidenceId: row.evidenceId,
          milestoneId: row.milestoneId,
          decision: row.decision,
          verifierRole: row.verifierRole,
          comment: row.comment,
          createdAt: row.createdAt.toISOString(),
        },
      },
      201,
    );
  } catch (error) {
    next(error);
  }
}
