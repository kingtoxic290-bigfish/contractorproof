import { normalizeSha256 } from "../../repositories/sha256";
import { sha256Buffer } from "../../utils/hash";

/**
 * Canonical evidence digest.
 * SHA-256 of the raw uploaded bytes, returned as 64 lowercase hex characters.
 * Do not hash filenames, paths, JSON metadata, base64 wrappers, or an existing digest.
 */
export function hashEvidenceBytes(bytes: Buffer): string {
  return normalizeSha256(sha256Buffer(bytes));
}
