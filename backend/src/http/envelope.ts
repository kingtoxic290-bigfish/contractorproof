import type { Response } from "express";

export function sendData(
  res: Response,
  data: Record<string, unknown>,
  statusCode = 200,
  meta: Record<string, unknown> = {},
): void {
  res.status(statusCode).json({ data, meta });
}

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  requestId?: string,
): void {
  res.status(statusCode).json({
    error: {
      code,
      message,
      requestId: requestId ?? "",
    },
  });
}
