import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { ApiError } from "../../../services/api/errors";
import { createPublicVerification, publicVerificationErrorMessage } from "./publicVerificationApi";

vi.mock("../../../services/api/client", () => ({ apiRequest: vi.fn() }));

const versionId = "11111111-1111-4111-8111-111111111111";
const verification = {
  status: "MATCH",
  evidenceVersionId: versionId,
  meaning: "The submitted file matches the evidence fingerprint in a confirmed verification proof.",
  blockchainProof: { confirmed: true, transactionHash: "0xabc", blockNumber: 42 },
};

describe("publicVerificationApi", () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it("posts the backend-required multipart fields to the public endpoint without auth redirects", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification }, meta: {} });
    const file = new File(["proof"], "proof.txt", { type: "text/plain" });

    await expect(createPublicVerification({ evidenceVersionId: versionId, file })).resolves.toMatchObject({
      status: "MATCH",
      blockchainProof: { confirmed: true, blockNumber: 42 },
    });

    expect(apiRequest).toHaveBeenCalledWith("/public/verify", {
      method: "POST",
      body: expect.any(FormData),
      skipAuthRedirect: true,
    });
    const [, options] = vi.mocked(apiRequest).mock.calls[0] as [string, { body: FormData }];
    expect(options.body.get("evidenceVersionId")).toBe(versionId);
    expect(options.body.get("file")).toBe(file);
  });

  it.each(["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"] as const)(
    "accepts the canonical %s state",
    async (status) => {
      vi.mocked(apiRequest).mockResolvedValue({
        data: { verification: { ...verification, status, blockchainProof: { confirmed: false } } }, meta: {},
      });
      const file = new File(["proof"], "proof.txt");
      await expect(createPublicVerification({ evidenceVersionId: versionId, file })).resolves.toMatchObject({
        status,
        blockchainProof: { confirmed: false },
      });
    },
  );

  it("rejects malformed result data and does not retain internal fields", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        verification: { ...verification, status: "TRUSTED", storageReference: "/private/file", privateKey: "no" },
      }, meta: {},
    });
    await expect(createPublicVerification({ evidenceVersionId: versionId, file: new File(["x"], "x.txt") })).rejects.toThrow(
      "The public verification response is not in a known format.",
    );

    vi.mocked(apiRequest).mockResolvedValue({
      data: { verification: { ...verification, storageReference: "/private/file", privateKey: "no" } }, meta: {},
    });
    const result = await createPublicVerification({ evidenceVersionId: versionId, file: new File(["x"], "x.txt") });
    expect(JSON.stringify(result)).not.toMatch(/storageReference|privateKey|\/private/);
  });

  it("requires a positive block number before accepting confirmed proof", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { verification: { ...verification, blockchainProof: { confirmed: true, transactionHash: "0xabc", blockNumber: 0 } }, meta: {} },
    });
    await expect(createPublicVerification({ evidenceVersionId: versionId, file: new File(["x"], "x.txt") })).rejects.toThrow(
      "The public verification response is not in a known format.",
    );
  });

  it.each([
    [new ApiError(400, "file is required"), "file is required"],
    [new ApiError(404, "not found"), "The supplied evidence reference was not found."],
    [new ApiError(409, "conflict"), "The verification request could not be completed because of a conflict."],
    [new ApiError(429, "slow down"), "Too many requests. Please try again later."],
    [new ApiError(500, "database path"), "The verification service could not complete the request."],
    [new TypeError("network"), "We couldn't reach the verification service. Please try again."],
  ])("maps request errors without calling them UNAVAILABLE", (error, message) => {
    expect(publicVerificationErrorMessage(error)).toBe(message);
  });
});
