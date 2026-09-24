import jwt from "jsonwebtoken";
import { env } from "../config/env";
import type { JwtPayload } from "../types";

const EXPIRES_IN = "12h";

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.jwtSecret, { expiresIn: EXPIRES_IN });
}

export function verifyAccessToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, env.jwtSecret);
  if (typeof decoded === "string" || !decoded.sub || !decoded.role || !decoded.email) {
    throw new Error("Invalid token payload");
  }
  return {
    sub: decoded.sub,
    email: decoded.email,
    role: decoded.role,
  };
}
