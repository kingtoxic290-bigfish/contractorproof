import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadDashboard } from "../../../pages/dashboardApi";
import { listVerificationHistory } from "./verificationHistoryApi";

vi.mock("../../../pages/dashboardApi", () => ({
  loadDashboard: vi.fn(),
}));

describe("verification history projection", () => {
  beforeEach(() => {
    vi.mocked(loadDashboard).mockReset();
  });

  it("preserves backend verification order and associates proof by evidence version", async () => {
    vi.mocked(loadDashboard).mockResolvedValue([
      {
        contractor: { id: "c1", legalName: "Harbor Works" },
        project: {
          id: "p1",
          contractorId: "c1",
          name: "Bridge deck",
          contractStatus: null,
          createdAt: "2026-09-01T00:00:00.000Z",
        },
        milestones: [
          {
            id: "m1",
            name: "Foundation",
            status: "PENDING",
            createdAt: "2026-09-02T00:00:00.000Z",
            evidence: [
              {
                id: "e1",
                milestoneId: "m1",
                createdAt: "2026-09-03T00:00:00.000Z",
                versions: [
                  {
                    id: "v1",
                    versionNumber: 1,
                    sha256: "a".repeat(64),
                    createdAt: "2026-09-04T00:00:00.000Z",
                    verificationStatus: "MISMATCH",
                    verifications: [
                      { id: "r1", status: "MATCH", source: "INTERNAL", createdAt: "2026-09-05T00:00:00.000Z" },
                      { id: "r2", status: "MISMATCH", source: "INTERNAL", createdAt: "2026-09-06T00:00:00.000Z" },
                    ],
                  },
                ],
                attestations: [],
              },
            ],
          },
        ],
        blockchainProofs: [
          {
            id: "proof-v1",
            eventType: "VERIFICATION",
            referenceId: "v1",
            txHash: "0xproof",
            blockNumber: 42,
            confirmationState: "CONFIRMED",
            confirmed: true,
            createdAt: "2026-09-05T00:01:00.000Z",
          },
        ],
      },
    ]);

    const history = await listVerificationHistory();

    expect(history.map((entry) => entry.verification.id)).toEqual(["r1", "r2"]);
    expect(history[0]).toMatchObject({
      projectId: "p1",
      projectName: "Bridge deck",
      milestoneId: "m1",
      milestoneName: "Foundation",
      evidenceId: "e1",
      evidenceVersionId: "v1",
      versionNumber: 1,
      proof: { id: "proof-v1", referenceId: "v1" },
    });
    expect(loadDashboard).toHaveBeenCalledOnce();
  });

  it("returns an empty history when the authorized projection has no records", async () => {
    vi.mocked(loadDashboard).mockResolvedValue([]);
    await expect(listVerificationHistory()).resolves.toEqual([]);
  });
});