import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { ApiError } from "../../../services/api/errors";
import { verificationRecord } from "../../../tests/fixtures";
import { createVerification } from "./verificationApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const match = verificationRecord({ status: "MATCH" });

describe("verificationApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a data.verification envelope and keeps MATCH", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification: match, proof: null }, meta: {} });

    const result = await createVerification({
      evidenceId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.status).toBe("MATCH");
    expect(result.status).not.toBe("VERIFIED");
    expect(result.source).toBe("INTERNAL");
    expect(apiRequest).toHaveBeenCalledWith("/verification", {
      method: "POST",
      body: { evidenceId: "11111111-1111-4111-8111-111111111111" },
    });
  });

  it("sends multipart when a presented file is included", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { verification: verificationRecord({ status: "MISMATCH" }), proof: null },
      meta: {},
    });
    const file = new File(["tampered"], "tampered.txt", { type: "text/plain" });

    const result = await createVerification({
      evidenceVersionId: "22222222-2222-4222-8222-222222222222",
      file,
    });

    expect(result.status).toBe("MISMATCH");
    expect(result.status).not.toBe("MATCH");
    expect(apiRequest).toHaveBeenCalledWith("/verification", {
      method: "POST",
      body: expect.any(FormData),
    });
    const [, options] = vi.mocked(apiRequest).mock.calls[0] as [string, { body: FormData }];
    expect(options.body.get("evidenceVersionId")).toBe("22222222-2222-4222-8222-222222222222");
    expect(options.body.get("file")).toBe(file);
    expect(Array.from(options.body.keys())).toEqual(["evidenceVersionId", "file"]);
  });

  it("accepts PENDING and UNAVAILABLE with null identifiers", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        verification: {
          id: null,
          status: "PENDING",
          source: "INTERNAL",
          evidenceId: "e1",
          evidenceVersionId: "v1",
          sha256: null,
          createdAt: null,
        },
        proof: null,
      },
      meta: {},
    });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toMatchObject({ status: "PENDING", id: null, sha256: null });

    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        verification: {
          id: null,
          status: "UNAVAILABLE",
          source: "INTERNAL",
          evidenceId: null,
          evidenceVersionId: null,
          sha256: null,
          createdAt: null,
        },
        proof: null,
      },
      meta: {},
    });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });
  });

  it("rejects a response without the data envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ verification: match, proof: null });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toThrow("The verification response is not in a known format.");
  });

  it.each([
    [{ ...match, status: "TRUSTED" }, null],
    [{ ...match, sha256: "bad-hash" }, null],
    [{ ...match, source: "PUBLIC" }, null],
    [{ ...match, createdAt: 42 }, null],
  ])("rejects malformed verification result fields", async (verification) => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification, proof: null }, meta: {} });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toThrow("The verification response is not in a known format.");
  });

  it("does not expose secrets from a well-formed payload", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification: match, proof: null }, meta: {} });
    const result = await createVerification({
      evidenceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.stringify(result)).not.toMatch(/privateKey|rpc|wallet|passwordHash|storageKey/);
  });

  it("keeps only minimal backend proof metadata and rejects malformed proof data", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        verification: match,
        proof: {
          id: "proof-1",
          eventType: "VERIFICATION",
          txHash: "0xabc",
          blockNumber: 42,
          evidenceHash: match.sha256,
        },
      },
      meta: {},
    });
    await expect(createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" })).resolves.toMatchObject({
      proof: { id: "proof-1", blockNumber: 42 },
    });

    vi.mocked(apiRequest).mockResolvedValue({
      data: { verification: match, proof: { id: "proof-1" } },
      meta: {},
    });
    await expect(createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow(
      "The verification response is not in a known format.",
    );
  });

  it.each([
    new ApiError(401, "authentication required", undefined, "UNAUTHENTICATED"),
    new ApiError(403, "insufficient project access", undefined, "FORBIDDEN"),
    new ApiError(404, "evidence version not found", undefined, "VERSION_NOT_FOUND"),
    new ApiError(400, "evidenceId or evidenceVersionId is required", undefined, "VALIDATION_ERROR"),
  ])("preserves backend HTTP errors without rewriting their codes", async (error) => {
    vi.mocked(apiRequest).mockRejectedValue(error);
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toBe(error);
  });

  it("rejects a missing meta envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification: match, proof: null } });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toThrow("The verification response is not in a known format.");
  });
});
