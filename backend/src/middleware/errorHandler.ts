import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { ApiError } from "../http/errors";
import { sendError } from "../http/envelope";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "../services/evidence";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function notImplemented(resource: string) {
  return (_req: Request, res: Response) => {
    res.status(501).json({
      error: "Not implemented in scaffold phase",
      resource,
    });
  };
}

const EVIDENCE_STATUS: Record<string, number> = {
  [EVIDENCE_ERROR_CODES.VALIDATION_ERROR]: 400,
  [EVIDENCE_ERROR_CODES.FILE_EMPTY]: 400,
  [EVIDENCE_ERROR_CODES.FILE_TOO_LARGE]: 400,
  [EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED]: 400,
  [EVIDENCE_ERROR_CODES.PROJECT_NOT_FOUND]: 404,
  [EVIDENCE_ERROR_CODES.MILESTONE_NOT_FOUND]: 404,
  [EVIDENCE_ERROR_CODES.EVIDENCE_NOT_FOUND]: 404,
  [EVIDENCE_ERROR_CODES.VERSION_NOT_FOUND]: 404,
  [EVIDENCE_ERROR_CODES.HASH_CONFLICT]: 409,
  [EVIDENCE_ERROR_CODES.CONFLICT]: 409,
  [EVIDENCE_ERROR_CODES.STORAGE_FAILED]: 503,
  [EVIDENCE_ERROR_CODES.VERIFICATION_UNAVAILABLE]: 503,
};

function leaksInternalDetail(message: string): boolean {
  return /prisma|sql|filesystem|stack|ECONNREFUSED|\/home\/|\/var\/|\/tmp\/|storage\//i.test(
    message,
  );
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.requestId ?? "";

  if (err instanceof EvidenceError) {
    const statusCode = EVIDENCE_STATUS[err.code] ?? 400;
    sendError(res, statusCode, err.code, err.message, requestId);
    return;
  }

  if (err instanceof ApiError) {
    sendError(res, err.statusCode, err.code, err.message, requestId);
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  const fallback =
    env.nodeEnv === "production" || !(err instanceof Error) || leaksInternalDetail(err.message)
      ? "internal server error"
      : err.message;
  sendError(res, 500, "INTERNAL_ERROR", fallback, requestId);
}
