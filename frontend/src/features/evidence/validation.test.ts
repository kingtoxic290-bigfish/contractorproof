import { describe, expect, it } from "vitest";
import { EVIDENCE_MAX_FILE_BYTES, validateEvidenceFile } from "./validation";

describe("evidence file validation", () => {
  it("accepts an allowed JPEG", () => {
    const file = new File(["abc"], "site.jpg", { type: "image/jpeg" });
    expect(validateEvidenceFile(file)).toEqual({ ok: true });
  });

  it("rejects an unsupported extension", () => {
    const file = new File(["abc"], "payload.exe", { type: "application/octet-stream" });
    expect(validateEvidenceFile(file)).toEqual({ ok: false, reason: "unsupported" });
  });

  it("rejects an oversized file", () => {
    const file = new File([new Uint8Array(EVIDENCE_MAX_FILE_BYTES + 1)], "big.jpg", {
      type: "image/jpeg",
    });
    expect(validateEvidenceFile(file)).toEqual({ ok: false, reason: "too_large" });
  });

  it("rejects an empty file", () => {
    const file = new File([], "empty.jpg", { type: "image/jpeg" });
    expect(validateEvidenceFile(file)).toEqual({ ok: false, reason: "empty" });
  });
});
