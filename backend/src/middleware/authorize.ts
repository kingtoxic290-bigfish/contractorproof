import type { Role } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./errorHandler";

export function authorize(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new HttpError(401, "unauthenticated"));
      return;
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      next(new HttpError(403, "insufficient role"));
      return;
    }
    next();
  };
}

export const requireRole = authorize;
