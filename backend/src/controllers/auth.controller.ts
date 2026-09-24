import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth.service";
import { HttpError } from "../middleware/errorHandler";
import { auditService } from "../services/audit.service";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.register(req.body ?? {});
    await auditService.record({
      userId: result.user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: result.user.id,
      metadata: { role: result.user.role },
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const result = await authService.login(req.body ?? {});
    await auditService.record({
      userId: result.user.id,
      action: "USER_LOGIN",
      entityType: "User",
      entityId: result.user.id,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new HttpError(401, "unauthenticated");
    }
    const user = await authService.me(req.user.id);
    res.json({ user });
  } catch (error) {
    next(error);
  }
}
