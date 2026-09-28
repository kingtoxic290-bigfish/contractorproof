import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { evidenceRecord } from "../../../tests/fixtures";
import {
  listEvidence,
  listEvidenceByMilestone,
  listEvidenceByProject,
  uploadEvidence,
} from "./evidenceApi";

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

  it("lists evidence through project and milestone scoped endpoint filters", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [site] }, meta: {} });
    const projectId = "11111111-1111-4111-8111-111111111111";
    const milestoneId = "22222222-2222-4222-8222-222222222222";

    await expect(listEvidenceByProject(projectId)).resolves.toEqual([site]);
    expect(apiRequest).toHaveBeenLastCalledWith(`/evidence?projectId=${projectId}`);
    await expect(listEvidenceByMilestone(milestoneId)).resolves.toEqual([site]);
    expect(apiRequest).toHaveBeenLastCalledWith(`/evidence?milestoneId=${milestoneId}`);
  });

  it("unwraps an empty evidence collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [] }, meta: {} });

    await expect(listEvidence()).resolves.toEqual([]);
  });

  it("uploads multipart file and milestoneId fields and keeps returned statuses", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: site }, meta: {} });
    const file = new File(["bytes"], "site.jpg", { type: "image/jpeg" });

    const created = await uploadEvidence({
      milestoneId: site.milestoneId,
      file,
    });

    expect(created.status).toBe("PENDING_VERIFICATION");
    expect(created.verificationStatus).toBe("PENDING");
    expect(created.status).not.toBe("VERIFIED");
    expect(created.currentVersion?.versionNumber).toBe(1);
    const [, options] = vi.mocked(apiRequest).mock.calls[0] as [string, { body: FormData }];
    expect(options.body.get("milestoneId")).toBe(site.milestoneId);
    expect(options.body.get("file")).toBe(file);
    expect(apiRequest).toHaveBeenCalledWith("/evidence", {
      method: "POST",
      body: expect.any(FormData),
    });
  });

  it("rejects malformed persisted status, hash, and version data", async () => {
    const malformed = [
      { ...site, verificationStatus: "TRUSTED" },
      { ...site, sha256: "not-a-sha256" },
      { ...site, currentVersion: { ...site.currentVersion, versionNumber: 0 } },
      Object.fromEntries(Object.entries(site).filter(([key]) => key !== "currentVersion")),
    ];

    for (const record of malformed) {
      vi.mocked(apiRequest).mockResolvedValue({ data: { evidence: [record] }, meta: {} });
      await expect(listEvidence()).rejects.toThrow(
        "The evidence list response is not in a known format.",
      );
    }
  });

  it("rejects malformed project identifiers instead of requesting an unfiltered list", async () => {
    await expect(listEvidenceByProject("not-a-uuid")).rejects.toThrow(
      "A valid project identifier is required to list evidence.",
    );
    expect(apiRequest).not.toHaveBeenCalled();
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
