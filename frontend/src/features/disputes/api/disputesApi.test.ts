import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import {
  createDispute,
  listDisputes,
  markDisputeUnderReview,
  resolveDispute,
} from "./disputesApi";

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

function dispute(overrides: Record<string, unknown> = {}) {
  return {
    id: "dispute-1",
    milestoneId: "milestone-1",
    evidenceId: "evidence-1",
    raisedById: "user-1",
    status: "OPEN",
    reason: "The verification result does not match the site condition.",
    originalEventId: "event-1",
    createdAt: "2026-10-01T10:00:00.000Z",
    updatedAt: "2026-10-01T10:00:00.000Z",
    blockchainProof: null,
    originalProof: proof,
    resolutionProof: null,
    resolutions: [],
    ...overrides,
  };
}

describe("disputesApi", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps the data envelope for a dispute list", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { disputes: [dispute()] }, meta: {} });

    const records = await listDisputes();

    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("OPEN");
    expect(records[0].reason).toBe("The verification result does not match the site condition.");
  });

  it("passes project and milestone filters", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { disputes: [] }, meta: {} });

    await listDisputes({ projectId: "project-1" });

    expect(apiRequest).toHaveBeenCalledWith("/disputes?projectId=project-1");
  });

  it("rejects a record carrying an unknown status", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { disputes: [dispute({ status: "ESCALATED" })] },
      meta: {},
    });

    await expect(listDisputes()).rejects.toThrow("not in a known format");
  });

  it("does not mutate the original proof when a resolution is recorded", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: {
        disputes: [
          dispute({
            status: "RESOLVED",
            resolutionProof: {
              ...proof,
              id: "event-2",
              eventType: "DISPUTE_RESOLUTION",
            },
            resolutions: [
              {
                id: "resolution-1",
                status: "RESOLVED",
                resolution: "Site visit confirmed the original evidence.",
                resolvedById: "user-9",
                resolvedByRole: "AUDITOR",
                createdAt: "2026-10-03T10:00:00.000Z",
              },
            ],
          }),
        ],
      },
      meta: {},
    });

    const records = await listDisputes();

    expect(records[0].status).toBe("RESOLVED");
    // The original verification proof is preserved untouched.
    expect(records[0].originalProof?.id).toBe("event-1");
    expect(records[0].resolutionProof?.eventType).toBe("DISPUTE_RESOLUTION");
    expect(records[0].resolutions[0].resolvedByRole).toBe("AUDITOR");
  });

  it("posts a dispute without inventing identifiers", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { dispute: dispute() }, meta: {} });

    await createDispute({ milestoneId: "milestone-1", reason: "Disagrees with the result." });

    expect(apiRequest).toHaveBeenCalledWith("/disputes", {
      method: "POST",
      body: { milestoneId: "milestone-1", reason: "Disagrees with the result." },
    });
  });

  it("moves a dispute under review", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { dispute: dispute({ status: "UNDER_REVIEW" }) },
      meta: {},
    });

    const record = await markDisputeUnderReview("dispute-1");

    expect(apiRequest).toHaveBeenCalledWith("/disputes/dispute-1/review", { method: "POST" });
    expect(record.status).toBe("UNDER_REVIEW");
  });

  it("resolves a dispute to RESOLVED", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { dispute: dispute({ status: "RESOLVED" }) },
      meta: {},
    });

    const record = await resolveDispute({
      disputeId: "dispute-1",
      status: "RESOLVED",
      resolution: "Resolved after site visit.",
    });

    expect(apiRequest).toHaveBeenCalledWith("/disputes/dispute-1/resolutions", {
      method: "POST",
      body: { status: "RESOLVED", resolution: "Resolved after site visit." },
    });
    expect(record.status).toBe("RESOLVED");
  });
});