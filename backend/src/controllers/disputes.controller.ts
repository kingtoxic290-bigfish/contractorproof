import { DisputeStatus, type BlockchainEvent } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { requireUuid } from "../services/evidence/validation";
import { disputeListWhere } from "../services/access.service";
import { disputeService, type DisputeRecord } from "../services/dispute.service";
import type { ProofView } from "../services/proof.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

function toHttpBlockchainEvent(event: Pick<BlockchainEvent, "id" | "eventType" | "referenceId" | "txHash" | "blockNumber"> | ProofView | null) {
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

function toHttpDispute(row: DisputeRecord, disputeProof?: ProofView | null) {
  return {
    id: row.id,
    milestoneId: row.milestoneId,
    evidenceId: row.evidenceId,
    raisedById: row.raisedById,
    status: row.status,
    reason: row.reason,
    originalEventId: row.originalEventId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    blockchainProof: toHttpBlockchainEvent(
      disputeProof === undefined ? row.disputeEvent : disputeProof,
    ),
    originalProof: toHttpBlockchainEvent(row.originalEvent),
    resolutionProof: toHttpBlockchainEvent(row.resolutionEvent),
    resolutions: row.resolutions.map((resolution) => ({
      id: resolution.id,
      status: resolution.status,
      resolution: resolution.resolution,
      resolvedById: resolution.resolvedById,
      resolvedByRole: resolution.resolvedBy.role,
      createdAt: resolution.createdAt.toISOString(),
    })),
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
    const evidenceId = typeof req.body?.evidenceId === "string" ? req.body.evidenceId.trim() : "";
    const originalEventId = typeof req.body?.originalEventId === "string" ? req.body.originalEventId.trim() : "";

    if (!milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "milestoneId is required");
    }
    requireUuid(milestoneId, "milestoneId");
    if (evidenceId) requireUuid(evidenceId, "evidenceId");
    if (originalEventId) requireUuid(originalEventId, "originalEventId");
    if (!reason.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "reason is required");
    }

    // Identity and lifecycle status are server-controlled.
    const { dispute, blockchainProof } = await disputeService.create({
      actor,
      milestoneId,
      reason,
      evidenceId: evidenceId || undefined,
      originalEventId: originalEventId || undefined,
    });
    sendData(res, { dispute: toHttpDispute(dispute, blockchainProof) }, 201);
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
    sendData(res, { disputes: rows.map((row) => toHttpDispute(row)) });
  } catch (error) {
    next(error);
  }
}

export async function getDispute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = requireUuid(req.params.disputeId, "disputeId");
    const result = await disputeService.getById(requireUser(req), id);
    sendData(res, {
      dispute: toHttpDispute(result.dispute, result.blockchainProof),
      resolutionProof: toHttpBlockchainEvent(result.resolutionProof),
    });
  } catch (error) {
    next(error);
  }
}

export async function markDisputeUnderReview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const id = requireUuid(req.params.disputeId, "disputeId");
    const dispute = await disputeService.markUnderReview(requireUser(req), id);
    sendData(res, { dispute: toHttpDispute(dispute) });
  } catch (error) {
    next(error);
  }
}

export async function resolveDispute(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const disputeId = requireUuid(req.params.disputeId, "disputeId");
    const status = String(req.body?.status ?? "").trim() as DisputeStatus;
    const resolution = typeof req.body?.resolution === "string" ? req.body.resolution : "";
    if (status !== DisputeStatus.RESOLVED && status !== DisputeStatus.REJECTED) {
      throw new ApiError(400, "VALIDATION_ERROR", "status must be RESOLVED or REJECTED");
    }
    if (!resolution.trim()) {
      throw new ApiError(400, "VALIDATION_ERROR", "resolution is required");
    }
    const result = await disputeService.resolve({ actor, disputeId, status, resolution });
    sendData(res, {
      dispute: toHttpDispute(result.dispute),
      resolution: {
        id: result.resolution.id,
        status: result.resolution.status,
        resolution: result.resolution.resolution,
        resolvedById: result.resolution.resolvedById,
        resolvedByRole: result.resolution.resolvedBy.role,
        createdAt: result.resolution.createdAt.toISOString(),
      },
      blockchainProof: toHttpBlockchainEvent(result.blockchainProof),
    }, 201);
  } catch (error) {
    next(error);
  }
}
