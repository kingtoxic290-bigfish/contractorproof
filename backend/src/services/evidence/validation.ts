import path from "path";
import {
  allowedMimeForExtension,
  canonicalizeMime,
  EVIDENCE_MAX_FILE_BYTES,
} from "./config";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "./errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function requireUuid(value: string | undefined, field: string): string {
  if (!value || !UUID_PATTERN.test(value)) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.VALIDATION_ERROR,
      `${field} must be a valid UUID`,
    );
  }
  return value;
}

export function sanitizeOriginalName(originalName: string | undefined): string {
  if (!originalName || !originalName.trim()) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.VALIDATION_ERROR,
      "originalName is required",
    );
  }
  const base = path.basename(originalName.replaceAll("\0", "").replaceAll("\\", "/")).trim();
  if (!base || base === "." || base === "..") {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.VALIDATION_ERROR,
      "originalName is invalid",
    );
  }
  return base.slice(0, 255);
}

export function validateUploadBuffer(
  buffer: Buffer | undefined,
  originalName: string,
  mimeType: string | undefined,
): { fileName: string; mimeType: string } {
  if (!buffer) {
    throw new EvidenceError(EVIDENCE_ERROR_CODES.FILE_EMPTY, "file is required");
  }
  if (buffer.length === 0) {
    throw new EvidenceError(EVIDENCE_ERROR_CODES.FILE_EMPTY, "file must not be empty");
  }
  if (buffer.length > EVIDENCE_MAX_FILE_BYTES) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.FILE_TOO_LARGE,
      `file exceeds the ${EVIDENCE_MAX_FILE_BYTES} byte limit`,
    );
  }

  const fileName = sanitizeOriginalName(originalName);
  const extension = path.extname(fileName).toLowerCase();
  const expectedMime = allowedMimeForExtension(extension);
  if (!expectedMime) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
      "file type is not allowed",
    );
  }

  const providedMime = canonicalizeMime(mimeType);
  if (providedMime && providedMime !== expectedMime) {
    throw new EvidenceError(
      EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
      "file type does not match the file extension",
    );
  }

  return { fileName, mimeType: expectedMime };
}
