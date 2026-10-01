import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { assertCanReadContractor } from "../services/access.service";
import { crbService } from "../services/crb.service";
import type { PublicUser } from "../types";

function actor(req: Request): PublicUser {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

/**
 * GET /api/v1/contractors/:contractorId/crb
 *
 * Returns the append-only CRB check history plus the latest check. No endpoint
 * exists that creates, edits or deletes a CRB record: checks are only ever
 * produced by running a check against the adapter.
 */
export async function getContractorCrbVerifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = actor(req);
    const contractorId = req.params.contractorId;
    await assertCanReadContractor(user, contractorId);

    const [history, latest] = await Promise.all([
      crbService.listHistory(contractorId),
      crbService.latestFor(contractorId),
    ]);

    sendData(res, {
      contractorId,
      registrationReference: history[0]?.registrationReference ?? null,
      current: latest.latestCompleted,
      latestAttempt: latest.latest,
      history,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/v1/contractors/:contractorId/crb/verify
 *
 * Performs one CRB registration check and appends the factual result.
 */
export async function verifyContractorWithCrb(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = actor(req);
    const contractorId = req.params.contractorId;
    await assertCanReadContractor(user, contractorId);

    const result = await crbService.verifyContractorWithCRB(user, contractorId);
    sendData(res, { verification: result.verification }, 201);
  } catch (error) {
    next(error);
  }
}