import { CorrectionStatus, type BlockchainEvent } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { correctionListWhere } from "../services/access.service";
import { correctionService, type CorrectionRecord } from "../services/correction.service";
import { requireUuid } from "../services/evidence/validation";
import type { ProofView } from "../services/proof.service";

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  return req.user;
}

function toProof(event: Pick<BlockchainEvent, "id" | "eventType" | "referenceId" | "txHash" | "blockNumber"> | ProofView | null) {
  if (!event) return null;
  const confirmed = Boolean(event.txHash && event.blockNumber != null && event.blockNumber > 0);
  return {
    id: event.id,
    eventType: event.eventType,
    referenceId: "referenceId" in event ? event.referenceId : null,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    confirmationState: confirmed ? "CONFIRMED" : "PENDING",
    confirmed,
  };
}

function toHttpCorrection(row: CorrectionRecord, proof?: ProofView | null) {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    originalEventId: row.originalEventId,
    originalProof: toProof(row.originalEvent),
    originalEvidenceVersion: row.originalEvidenceVersion
      ? {
          id: row.originalEvidenceVersion.id,
          evidenceId: row.originalEvidenceVersion.evidenceId,
          versionNumber: row.originalEvidenceVersion.versionNumber,
          sha256: row.originalEvidenceVersion.sha256,
          createdAt: row.originalEvidenceVersion.createdAt.toISOString(),
        }
      : null,
    evidenceId: row.evidenceId,
    correctedEvidence: row.evidence
      ? {
          id: row.evidence.id,
          currentVersionId: row.evidence.currentVersionId,
          versions: row.evidence.versions.map((version) => ({
            id: version.id,
            versionNumber: version.versionNumber,
            sha256: version.sha256,
            createdAt: version.createdAt.toISOString(),
          })),
        }
      : null,
    actorId: row.actorId,
    reason: row.reason,
    status: row.status,
    blockchainProof: toProof(proof === undefined ? row.correctionEvent : proof),
    resolutions: row.resolutions.map((resolution) => ({
      id: resolution.id,
      status: resolution.status,
      resolution: resolution.resolution,
      correctedEvidenceVersion: resolution.correctedEvidenceVersion
        ? {
            id: resolution.correctedEvidenceVersion.id,
            evidenceId: resolution.correctedEvidenceVersion.evidenceId,
            versionNumber: resolution.correctedEvidenceVersion.versionNumber,
            sha256: resolution.correctedEvidenceVersion.sha256,
            createdAt: resolution.correctedEvidenceVersion.createdAt.toISOString(),
          }
        : null,
      resolvedById: resolution.resolvedById,
      resolvedByRole: resolution.resolvedBy.role,
      createdAt: resolution.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
  };
}

export async function createCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = String(req.body?.milestoneId ?? "").trim();
    const originalEventId = String(req.body?.originalEventId ?? "").trim();
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    const evidenceId = typeof req.body?.evidenceId === "string" ? req.body.evidenceId.trim() : "";
    if (!milestoneId) throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
    if (!originalEventId) throw new ApiError(400, "VALIDATION_ERROR", "originalEventId is required");
    requireUuid(milestoneId, "milestoneId");
    requireUuid(originalEventId, "originalEventId");
    if (evidenceId) requireUuid(evidenceId, "evidenceId");
    if (!reason.trim()) throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    const row = await correctionService.create({
      actor,
      milestoneId,
      originalEventId,
      reason,
      evidenceId: evidenceId || undefined,
    });
    sendData(res, { correction: toHttpCorrection(row) }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listCorrections(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = requireUser(req);
    const milestoneId = typeof req.query.milestoneId === "string" ? req.query.milestoneId.trim() : undefined;
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : undefined;
    if (milestoneId) requireUuid(milestoneId, "milestoneId");
    if (projectId) requireUuid(projectId, "projectId");
    const rows = await correctionService.listAccessible(correctionListWhere(actor, {
      milestoneId: milestoneId || undefined,
      projectId: projectId || undefined,
    }));
    sendData(res, { corrections: rows.map((row) => toHttpCorrection(row)) });
  } catch (error) {
    next(error);
  }
}

export async function getCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = requireUuid(req.params.correctionId, "correctionId");
    const result = await correctionService.getById(requireUser(req), id);
    sendData(res, { correction: toHttpCorrection(result.correction, result.blockchainProof) });
  } catch (error) {
    next(error);
  }
}

export async function markCorrectionUnderReview(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = requireUuid(req.params.correctionId, "correctionId");
    const correction = await correctionService.markUnderReview(requireUser(req), id);
    sendData(res, { correction: toHttpCorrection(correction) });
  } catch (error) {
    next(error);
  }
}

export async function resolveCorrection(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const actor = requireUser(req);
    const correctionId = requireUuid(req.params.correctionId, "correctionId");
    const status = String(req.body?.status ?? "").trim() as CorrectionStatus;
    const resolution = typeof req.body?.resolution === "string" ? req.body.resolution : "";
    const correctedEvidenceVersionId = typeof req.body?.correctedEvidenceVersionId === "string"
      ? req.body.correctedEvidenceVersionId.trim()
      : "";
    if (status !== CorrectionStatus.APPROVED && status !== CorrectionStatus.REJECTED) {
      throw new ApiError(400, "VALIDATION_ERROR", "status must be APPROVED or REJECTED");
    }
    if (!resolution.trim()) throw new ApiError(400, "VALIDATION_ERROR", "resolution is required");
    if (correctedEvidenceVersionId) requireUuid(correctedEvidenceVersionId, "correctedEvidenceVersionId");
    const result = await correctionService.resolve({
      actor,
      correctionId,
      status,
      resolution,
      correctedEvidenceVersionId: correctedEvidenceVersionId || undefined,
    });
    const correction = toHttpCorrection(result.correction);
    sendData(res, {
      correction,
      resolution: correction.resolutions.find((item) => item.id === result.resolution.id) ?? null,
      blockchainProof: toProof(result.blockchainProof),
    }, 201);
  } catch (error) {
    next(error);
  }
}
