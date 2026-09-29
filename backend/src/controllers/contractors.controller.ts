import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../http/errors";
import { assertCanReadContractor, contractorListWhere } from "../services/access.service";
import { contractorService } from "../services/contractor.service";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

export async function listContractors(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const contractors = await contractorService.list(contractorListWhere(actor));
    res.json({ contractors });
  } catch (error) {
    next(error);
  }
}

export async function getContractor(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const contractor = await contractorService.getById(
      requireUuid(req.params.contractorId, "contractorId"),
    );
    await assertCanReadContractor(actor, contractor.id);
    res.json({ contractor });
  } catch (error) {
    next(error);
  }
}
