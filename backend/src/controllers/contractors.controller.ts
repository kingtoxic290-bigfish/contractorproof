import type { Request, Response, NextFunction } from "express";
import { ApiError } from "../http/errors";
import { assertCanReadContractor, contractorListWhere } from "../services/access.service";
import { contractorService } from "../services/contractor.service";
import { requireUuid } from "../services/evidence/validation";
import { contractorPassportService } from "../services/contractorPassport.service";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

/**
 * Optional CRB Registration Number discovery filter.
 *
 * Absent means "no filter". A present-but-blank or repeated value is rejected
 * rather than silently ignored, so a search that matched nothing is never
 * presented as an unfiltered list.
 */
function crbRegistrationNumberFilter(req: Request): string | undefined {
  const raw = req.query.crbRegistrationNumber;
  if (raw === undefined) {
    return undefined;
  }
  if (typeof raw !== "string") {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "crbRegistrationNumber must be a single value",
    );
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "crbRegistrationNumber must not be blank",
    );
  }
  return trimmed;
}

export async function listContractors(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const crbRegistrationNumber = crbRegistrationNumberFilter(req);
    const where = contractorListWhere(actor);
    const contractors = await contractorService.list(
      crbRegistrationNumber
        ? {
            AND: [
              where,
              {
                crbRegistrationNumber: {
                  equals: crbRegistrationNumber.trim(),
                  mode: "insensitive",
                },
              },
            ],
          }
        : where,
    );
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

export async function getContractorPassport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const contractorPassport = await contractorPassportService.getByContractorId(
      actor,
      requireUuid(req.params.contractorId, "contractorId"),
    );
    res.json({ contractorPassport });
  } catch (error) {
    next(error);
  }
}

/**
 * Own-passport alias for a signed-in CONTRACTOR. Resolves the contractor record
 * from the authenticated user rather than accepting a client-supplied id, so a
 * contractor cannot reach another contractor's passport through this route.
 */
export async function getOwnContractorPassport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const contractorPassport = await contractorPassportService.getByActor(actor);
    res.json({ contractorPassport });
  } catch (error) {
    next(error);
  }
}