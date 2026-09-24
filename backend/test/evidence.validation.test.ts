import { describe, expect, it } from "vitest";
import { EVIDENCE_MAX_FILE_BYTES } from "../src/services/evidence/config";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "../src/services/evidence/errors";
import { hashEvidenceBytes } from "../src/services/evidence/hash";
import { requireUuid, sanitizeOriginalName, validateUploadBuffer } from "../src/services/evidence/validation";
import { sha256Buffer } from "../src/utils/hash";

function expectErrorCode(fn: () => unknown, code: string) {
  expect(fn).toThrow(EvidenceError);
  try {
    fn();
  } catch (error) {
    expect(error).toMatchObject({ code });
  }
}

describe("evidence validation and hashing", () => {
  it("sanitizes path traversal out of originalName", () => {
    expect(sanitizeOriginalName("../../../etc/passwd.jpg")).toBe("passwd.jpg");
    expect(sanitizeOriginalName("folder\\nested\\site.png")).toBe("site.png");
  });

  it("rejects empty, oversized, unknown, and MIME-mismatched files", () => {
    expectErrorCode(
      () => validateUploadBuffer(Buffer.alloc(0), "a.jpg", "image/jpeg"),
      EVIDENCE_ERROR_CODES.FILE_EMPTY,
    );
    expectErrorCode(
      () => validateUploadBuffer(Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1, 1), "a.jpg", "image/jpeg"),
      EVIDENCE_ERROR_CODES.FILE_TOO_LARGE,
    );
    expectErrorCode(
      () => validateUploadBuffer(Buffer.from("x"), "payload.exe", "application/octet-stream"),
      EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
    );
    expectErrorCode(
      () => validateUploadBuffer(Buffer.from("x"), "site.jpg", "application/pdf"),
      EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED,
    );
  });

  it("requires a UUID for identifiers", () => {
    expectErrorCode(() => requireUuid("not-a-uuid", "evidenceId"), EVIDENCE_ERROR_CODES.VALIDATION_ERROR);
  });

  it("hashes raw bytes only and is deterministic", () => {
    const original = Buffer.from("canonical-bytes");
    const digest = hashEvidenceBytes(original);
    expect(digest).toBe(sha256Buffer(original));
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(hashEvidenceBytes(Buffer.from("canonical-bytes"))).toBe(digest);
    expect(hashEvidenceBytes(Buffer.from("canonical-bytes!"))).not.toBe(digest);
    expect(digest).not.toBe(hashEvidenceBytes(Buffer.from(digest)));
  });
});
