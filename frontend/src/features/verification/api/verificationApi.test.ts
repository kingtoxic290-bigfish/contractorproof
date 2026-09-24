import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
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
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification: match }, meta: {} });

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
      data: { verification: verificationRecord({ status: "MISMATCH" }) },
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
      },
      meta: {},
    });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).resolves.toMatchObject({ status: "UNAVAILABLE" });
  });

  it("rejects a response without the data envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ verification: match });
    await expect(
      createVerification({ evidenceId: "11111111-1111-4111-8111-111111111111" }),
    ).rejects.toThrow("The verification response is not in a known format.");
  });

  it("does not expose secrets from a well-formed payload", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { verification: match }, meta: {} });
    const result = await createVerification({
      evidenceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(JSON.stringify(result)).not.toMatch(/privateKey|rpc|wallet|passwordHash|storageKey/);
  });
});
