import { createHash } from "crypto";

/**
 * Canonical SHA-256 of raw bytes. Evidence and verification must call this
 * (via `hashEvidenceBytes`) — never `sha256Hex`, filenames, or client-supplied digests.
 */
export function sha256Buffer(contents: Buffer): string {
  return createHash("sha256").update(contents).digest("hex");
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
