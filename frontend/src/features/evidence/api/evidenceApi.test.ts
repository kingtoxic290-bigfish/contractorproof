import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { evidenceRecord } from "../../../tests/fixtures";
import { createEvidence, listEvidence } from "./evidenceApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const site = evidenceRecord({
  id: "e1",
  fileName: "site.jpg",
});

describe("evidenceApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a data.evidence collection envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [site] }, meta: {} });

    await expect(listEvidence()).resolves.toEqual([site]);
    expect(apiRequest).toHaveBeenCalledWith("/evidence");
  });

  it("forwards optional project and milestone filters", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [] }, meta: {} });

    await expect(
      listEvidence({
        projectId: "11111111-1111-4111-8111-111111111111",
        milestoneId: "22222222-2222-4222-8222-222222222222",
      }),
    ).resolves.toEqual([]);
    expect(apiRequest).toHaveBeenCalledWith(
      "/evidence?milestoneId=22222222-2222-4222-8222-222222222222&projectId=11111111-1111-4111-8111-111111111111",
    );
  });

  it("unwraps an empty evidence collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [] }, meta: {} });

    await expect(listEvidence()).resolves.toEqual([]);
  });

  it("unwraps a create envelope and keeps workflow status", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: site }, meta: {} });
    const file = new File(["bytes"], "site.jpg", { type: "image/jpeg" });

    const created = await createEvidence({
      milestoneId: site.milestoneId,
      file,
    });

    expect(created.status).toBe("PENDING_VERIFICATION");
    expect(created.verificationStatus).toBe("PENDING");
    expect(created.status).not.toBe("VERIFIED");
    expect(created.currentVersion?.versionNumber).toBe(1);
    expect(apiRequest).toHaveBeenCalledWith("/evidence", {
      method: "POST",
      body: expect.any(FormData),
    });
  });

  it("rejects a Stage 2 collection envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ evidence: [site] });

    await expect(listEvidence()).rejects.toThrow("The evidence list response is not in a known format.");
  });

  it("does not expose storage paths from a well-formed payload", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [site] }, meta: {} });
    const [record] = await listEvidence();
    expect(JSON.stringify(record)).not.toMatch(/storageKey|storageReference|\/home\/|privateKey/);
  });
});
