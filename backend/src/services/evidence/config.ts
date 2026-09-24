/**
 * File limits for evidence bytes. The Express JSON 2mb cap is not the upload cap.
 * Agent 2 should set multipart limits to EVIDENCE_MAX_FILE_BYTES.
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

const MIME_ALIASES: Record<string, string> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
};

export function canonicalizeMime(mimeType: string | undefined): string | undefined {
  if (!mimeType) {
    return undefined;
  }
  const normalized = mimeType.trim().toLowerCase().split(";")[0]?.trim();
  if (!normalized) {
    return undefined;
  }
  return MIME_ALIASES[normalized] ?? normalized;
}

export function allowedMimeForExtension(extension: string): string | undefined {
  return EVIDENCE_ALLOWED_TYPES[extension.toLowerCase()];
}
