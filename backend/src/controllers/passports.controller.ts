import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { passportService } from "../services/passport.service";
import { requireUuid } from "../services/evidence/validation";

function requireUser(req: Request) {
  if (!req.user) {
    throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
  }
  return req.user;
}

export async function listPassports(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const passports = await passportService.list(requireUser(req));
    sendData(res, { passports });
  } catch (error) {
    next(error);
  }
}

export async function getPassport(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const actor = requireUser(req);
    const projectId = requireUuid(req.params.projectId, "projectId");
    const passport = await passportService.getByProjectId(actor, projectId);
    sendData(res, { passport });
  } catch (error) {
    next(error);
  }
}
