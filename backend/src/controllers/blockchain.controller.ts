import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { requireUuid } from "../services/evidence/validation";
import { blockchainHistoryService } from "../services/blockchainHistory.service";

function requireUser(req: Request) {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  return req.user;
}

function queryValue(req: Request, name: string): string | undefined {
  const value = req.query[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function listBlockchainHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = requireUser(req);
    const projectId = queryValue(req, "projectId");
    if (projectId) requireUuid(projectId, "projectId");
    const events = await blockchainHistoryService.list(actor, { projectId });
    sendData(res, { events });
  } catch (error) {
    next(error);
  }
}

export async function reconcileBlockchainEvent(req: Request, res: Response, next: NextFunction) {
  try {
    const actor = requireUser(req);
    const eventId = requireUuid(req.params.eventId, "eventId");
    const event = await blockchainHistoryService.reconcile(actor, eventId);
    if (!event) throw new ApiError(404, "BLOCKCHAIN_EVENT_NOT_FOUND", "blockchain event not found");
    sendData(res, { event });
  } catch (error) {
    next(error);
  }
}
