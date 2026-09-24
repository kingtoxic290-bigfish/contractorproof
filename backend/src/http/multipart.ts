import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { EVIDENCE_MAX_FILE_BYTES } from "../services/evidence";
import { ApiError } from "./errors";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: EVIDENCE_MAX_FILE_BYTES,
    files: 1,
    fields: 16,
  },
});

function mapMulterError(error: unknown, next: NextFunction): void {
  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    next(
      new ApiError(
        400,
        "FILE_TOO_LARGE",
        `file exceeds the ${EVIDENCE_MAX_FILE_BYTES} byte limit`,
      ),
    );
    return;
  }
  next(new ApiError(400, "VALIDATION_ERROR", "invalid multipart upload"));
}

export function acceptOptionalFile(req: Request, res: Response, next: NextFunction): void {
  const contentType = String(req.headers["content-type"] ?? "");
  if (!contentType.toLowerCase().includes("multipart/form-data")) {
    next();
    return;
  }
  upload.single("file")(req, res, (error) => {
    if (error) {
      mapMulterError(error, next);
      return;
    }
    next();
  });
}

export function requireMultipartFile(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error) => {
    if (error) {
      mapMulterError(error, next);
      return;
    }
    next();
  });
}

export function uploadedOriginalName(file: Express.Multer.File): string {
  try {
    return Buffer.from(file.originalname, "latin1").toString("utf8");
  } catch {
    return file.originalname;
  }
}

export function readBodyField(req: Request, name: string): string | undefined {
  const value = req.body?.[name];
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
