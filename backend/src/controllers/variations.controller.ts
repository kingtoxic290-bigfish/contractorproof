import { VariationStatus } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { requireUuid } from "../services/evidence/validation";
import { variationService, type VariationRecord } from "../services/variation.service";
import type { ProofView } from "../services/proof.service";

function actor(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  return req.user;
}

type PublicProof = Pick<ProofView, "id" | "eventType" | "txHash" | "blockNumber"> & { referenceId?: string | null };

function proofView(event: PublicProof | null) {
  if (!event) return null;
  const confirmed = Boolean(event.txHash && event.blockNumber != null && event.blockNumber > 0);
  return {
    id: event.id,
    eventType: event.eventType,
    referenceId: event.referenceId ?? null,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    confirmationState: confirmed ? "CONFIRMED" : "PENDING",
    confirmed,
  };
}

function response(row: VariationRecord, blockchainProof?: PublicProof | null) {
  return {
    id: row.id,
    projectId: row.projectId,
    milestoneId: row.milestoneId,
    variationReference: row.variationReference,
    reason: row.reason,
    status: row.status,
    actorId: row.actorId,
    reviewedById: row.reviewedById,
    reviewedByRole: row.reviewedBy?.role ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    originalState: row.originalState,
    proposedState: row.proposedState,
    previousProof: proofView(row.previousEvent),
    variationProof: proofView(blockchainProof === undefined ? row.variationEvent : blockchainProof),
    evidence: row.evidence ? { id: row.evidence.id, milestoneId: row.evidence.milestoneId, currentVersionId: row.evidence.currentVersionId, sha256: row.evidence.sha256 } : null,
    resolutions: row.resolutions.map((item) => ({ id: item.id, status: item.status, decision: item.decision, note: item.note, resolvedById: item.resolvedById, resolvedByRole: item.resolvedBy.role, createdAt: item.createdAt.toISOString() })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function createVariation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = actor(req);
    const projectId = String(req.body?.projectId ?? "").trim();
    const previousEventId = String(req.body?.previousEventId ?? "").trim();
    const milestoneId = typeof req.body?.milestoneId === "string" ? req.body.milestoneId.trim() : undefined;
    const evidenceId = typeof req.body?.evidenceId === "string" ? req.body.evidenceId.trim() : undefined;
    const variationReference = typeof req.body?.variationReference === "string" ? req.body.variationReference : "";
    const reason = typeof req.body?.reason === "string" ? req.body.reason : "";
    if (!projectId || !previousEventId) throw new ApiError(400, "VALIDATION_ERROR", "projectId and previousEventId are required");
    requireUuid(projectId, "projectId"); requireUuid(previousEventId, "previousEventId");
    if (milestoneId) requireUuid(milestoneId, "milestoneId");
    if (evidenceId) requireUuid(evidenceId, "evidenceId");
    if (variationReference.trim().length > 120) throw new ApiError(400, "VALIDATION_ERROR", "variationReference must be at most 120 characters");
    const row = await variationService.create({ actor: user, projectId, previousEventId, milestoneId, evidenceId, variationReference, reason, changes: req.body?.changes });
    sendData(res, { variation: response(row) }, 201);
  } catch (error) { next(error); }
}

export async function listVariations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId.trim() : undefined;
    if (projectId) requireUuid(projectId, "projectId");
    const rows = await variationService.list(actor(req), projectId);
    sendData(res, { variations: rows.map((row) => response(row)) });
  } catch (error) { next(error); }
}

export async function getVariation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = requireUuid(req.params.variationId, "variationId");
    const result = await variationService.get(actor(req), id);
    sendData(res, { variation: response(result.variation, result.blockchainProof) });
  } catch (error) { next(error); }
}

export async function reviewVariation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = requireUuid(req.params.variationId, "variationId");
    const row = await variationService.review(actor(req), id);
    sendData(res, { variation: response(row) });
  } catch (error) { next(error); }
}

export async function resolveVariation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = requireUuid(req.params.variationId, "variationId");
    const status = String(req.body?.status ?? "").trim() as VariationStatus;
    if (status !== VariationStatus.APPROVED && status !== VariationStatus.REJECTED) throw new ApiError(400, "VALIDATION_ERROR", "status must be APPROVED or REJECTED");
    const decision = typeof req.body?.decision === "string" ? req.body.decision : "";
    const note = typeof req.body?.note === "string" ? req.body.note : "";
    const result = await variationService.resolve({ actor: actor(req), id, status, decision, note });
    sendData(res, {
      variation: response(result.variation),
      resolution: {
        id: result.resolution.id,
        status: result.resolution.status,
        decision: result.resolution.decision,
        note: result.resolution.note,
        resolvedById: result.resolution.resolvedById,
        createdAt: result.resolution.createdAt.toISOString(),
      },
      blockchainProof: proofView(result.blockchainProof),
    }, 201);
  } catch (error) { next(error); }
}
