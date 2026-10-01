import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import {
  createCorrection,
  listCorrections,
  markCorrectionUnderReview,
  resolveCorrection,
} from "./correctionsApi";

vi.mock("../../../services/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../services/api/client")>();
  return { ...actual, apiRequest: vi.fn() };
});

const proof = {
  id: "event-1",
  eventType: "VERIFICATION",
  referenceId: null,
  txHash: "0xabc",
  blockNumber: 7,
  confirmationState: "CONFIRMED",
  confirmed: true,
};

function correction(overrides: Record<string, unknown> = {}) {
  return {
    id: "correction-1",
    milestoneId: "milestone-1",
    originalEventId: "event-1",
    originalProof: proof,
    originalEvidenceVersion: null,
    evidenceId: "evidence-1",
    correctedEvidence: null,
    actorId: "user-1",
    reason: "Photo does not show the completed pour.",
    status: "OPEN",
    blockchainProof: null,
    resolutions: [],
    createdAt: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("correctionsApi", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps the data envelope for a correction list", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { corrections: [correction()] }, meta: {} });

    const records = await listCorrections();

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("OPEN");
    expect(records[0].reason).toBe("Photo does not show the completed pour.");
  });

  it("passes project and milestone filters", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { corrections: [] }, meta: {} });

    await listCorrections({ projectId: "project-1", milestoneId: "milestone-1" });

    expect(apiRequest).toHaveBeenCalledWith(
      "/corrections?projectId=project-1&milestoneId=milestone-1",
    );
  });

  it("returns an empty list without inventing records", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { corrections: [] }, meta: {} });

    await expect(listCorrections()).resolves.toEqual([]);
  });

  it("rejects a list that is missing the envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ corrections: [correction()] });

    await expect(listCorrections()).rejects.toThrow("not in a known format");
  });

  it("rejects a record carrying an unknown status", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { corrections: [correction({ status: "MAYBE" })] },
      meta: {},
    });

    await expect(listCorrections()).rejects.toThrow("not in a known format");
  });

  it("keeps a pending blockchain proof pending", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        corrections: [
          correction({
            blockchainProof: { ...proof, txHash: null, blockNumber: null, confirmationState: "PENDING", confirmed: false },
          }),
        ],
      },
      meta: {},
    });

    const records = await listCorrections();

    expect(records[0].blockchainProof?.confirmationState).toBe("PENDING");
    expect(records[0].blockchainProof?.confirmed).toBe(false);
  });

  it("reads resolution history", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        corrections: [
          correction({
            status: "APPROVED",
            resolutions: [
              {
                id: "resolution-1",
                status: "APPROVED",
                resolution: "Corrected photo accepted.",
                correctedEvidenceVersion: null,
                resolvedById: "user-9",
                resolvedByRole: "AUDITOR",
                createdAt: "2026-10-02T10:00:00.000Z",
              },
            ],
          }),
        ],
      },
      meta: {},
    });

    const records = await listCorrections();

    expect(records[0].status).toBe("APPROVED");
    expect(records[0].resolutions[0].resolution).toBe("Corrected photo accepted.");
    expect(records[0].resolutions[0].resolvedByRole).toBe("AUDITOR");
  });

  it("posts a correction request", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { correction: correction() }, meta: {} });

    await createCorrection({
      milestoneId: "milestone-1",
      originalEventId: "event-1",
      reason: "Photo does not show the completed pour.",
    });

    expect(apiRequest).toHaveBeenCalledWith("/corrections", {
      method: "POST",
      body: {
        milestoneId: "milestone-1",
        originalEventId: "event-1",
        reason: "Photo does not show the completed pour.",
      },
    });
  });

  it("moves a correction under review", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { correction: correction({ status: "UNDER_REVIEW" }) },
      meta: {},
    });

    const record = await markCorrectionUnderReview("correction-1");

    expect(apiRequest).toHaveBeenCalledWith("/corrections/correction-1/review", {
      method: "POST",
    });
    expect(record.status).toBe("UNDER_REVIEW");
  });

  it("resolves a correction with a reason", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { correction: correction({ status: "REJECTED" }) },
      meta: {},
    });

    const record = await resolveCorrection({
      correctionId: "correction-1",
      status: "REJECTED",
      resolution: "Original evidence stands.",
    });

    expect(apiRequest).toHaveBeenCalledWith("/corrections/correction-1/resolve", {
      method: "POST",
      body: { status: "REJECTED", resolution: "Original evidence stands." },
    });
    expect(record.status).toBe("REJECTED");
  });
});