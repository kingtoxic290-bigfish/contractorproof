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
    const { attestation, proof } = await attestationService.create({
      actor,
      evidenceId,
      milestoneId,
      decision,
      comment,
    });

    sendData(
      res,
      {
        attestation,
        proof: toHttpProof(proof),
      },
      201,
    );
  } catch (error) {
    next(error);
  }
}

export async function listAttestations(
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
    const evidenceId =
      typeof req.query.evidenceId === "string" ? req.query.evidenceId.trim() : undefined;

    if (milestoneId) {
      requireUuid(milestoneId, "milestoneId");
    }
    if (projectId) {
      requireUuid(projectId, "projectId");
    }
    if (evidenceId) {
      requireUuid(evidenceId, "evidenceId");
    }

    const attestations = await attestationService.list(actor, {
      milestoneId,
      projectId,
      evidenceId,
    });
    sendData(res, { attestations });
  } catch (error) {
    next(error);
  }
}
