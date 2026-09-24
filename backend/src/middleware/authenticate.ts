import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { userRepository } from "../repositories/user.repository";
import { HttpError } from "./errorHandler";

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      throw new HttpError(401, "missing bearer token");
    }
    const token = header.slice("Bearer ".length);
    const payload = verifyAccessToken(token);
    const user = await userRepository.findById(payload.sub);
    if (!user) {
      throw new HttpError(401, "user not found");
    }
    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    next();
  } catch (error) {
    if (error instanceof HttpError) {
      next(error);
      return;
    }
    next(new HttpError(401, "invalid or expired token"));
  }
}
