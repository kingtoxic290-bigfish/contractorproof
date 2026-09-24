/**
 * Upload constraints copied from the backend evidence contract
 * (`EVIDENCE_MAX_FILE_BYTES` and `EVIDENCE_ALLOWED_TYPES`).
 * The backend remains authoritative.
 */
export const EVIDENCE_MAX_FILE_BYTES = 25 * 1024 * 1024;

export const EVIDENCE_ALLOWED_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".gif": "image/gif",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".csv": "text/csv",
  ".txt": "text/plain",
};

export const EVIDENCE_ACCEPT = Object.keys(EVIDENCE_ALLOWED_TYPES).join(",");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FileValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "too_large" | "unsupported" };

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function fileExtension(fileName: string): string {
  const trimmed = fileName.trim();
  const index = trimmed.lastIndexOf(".");
  if (index <= 0 || index === trimmed.length - 1) {
    return "";
  }
  return trimmed.slice(index).toLowerCase();
}

export function validateEvidenceFile(file: File): FileValidationResult {
  if (file.size === 0) {
    return { ok: false, reason: "empty" };
  }
  if (file.size > EVIDENCE_MAX_FILE_BYTES) {
    return { ok: false, reason: "too_large" };
  }
  const expectedMime = EVIDENCE_ALLOWED_TYPES[fileExtension(file.name)];
  if (!expectedMime) {
    return { ok: false, reason: "unsupported" };
  }
  return { ok: true };
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} bytes`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
