import type { NextFunction, Request, Response } from "express";
import { sendData } from "../http/envelope";
import { ApiError } from "../http/errors";
import { authService } from "../services/auth.service";

export async function createPrivilegedUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    if (!req.user) {
      throw new ApiError(401, "UNAUTHENTICATED", "unauthenticated");
    }
    const user = await authService.provisionPrivilegedUser({
      actor: req.user,
      email: String(req.body?.email ?? ""),
      password: String(req.body?.password ?? ""),
      fullName: String(req.body?.fullName ?? ""),
      role: String(req.body?.role ?? ""),
    });
    sendData(res, { user }, 201);
  } catch (error) {
    next(error);
  }
}
