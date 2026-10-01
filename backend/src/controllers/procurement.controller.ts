import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { assertCanReadProcurementForContractor } from "../services/access.service";
import { procurementService } from "../services/procurement.service";
import type { PublicUser } from "../types";

function actor(req: Request): PublicUser {
  if (!req.user) throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  return req.user;
}

export async function syncProcurementRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ocid = typeof req.body?.ocid === "string" ? req.body.ocid : "";
    const record = await procurementService.sync(actor(req), ocid);
    sendData(res, { record }, 201);
  } catch (error) {
    next(error);
  }
}

export async function listContractorProcurement(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = actor(req);
    const contractorId = req.params.contractorId;
    await assertCanReadProcurementForContractor(user, contractorId);
    const records = await procurementService.listForContractor(contractorId);
    sendData(res, { contractorId, records });
  } catch (error) {
    next(error);
  }
}

export async function linkProcurementRecord(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await procurementService.linkToContractor(
      actor(req),
      req.params.contractorId,
      req.params.recordId,
    );
    sendData(res, { link: result }, 201);
  } catch (error) {
    next(error);
  }
}