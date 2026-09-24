import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { attestationRecord } from "../../../tests/fixtures";
import { createAttestation } from "./attestationApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const approved = attestationRecord({ decision: "APPROVED", comment: "site inspection accepted" });

describe("attestationApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a data.attestation envelope and keeps APPROVED", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { attestation: approved }, meta: {} });

    const result = await createAttestation({
      evidenceId: approved.evidenceId,
      milestoneId: approved.milestoneId,
      decision: "APPROVED",
      comment: "site inspection accepted",
    });

    expect(result.decision).toBe("APPROVED");
    expect(result.decision).not.toBe("MATCH");
    expect(result.decision).not.toBe("VERIFIED");
    expect(result.verifierRole).toBe("AUDITOR");
    expect(apiRequest).toHaveBeenCalledWith("/attestations", {
      method: "POST",
      body: {
        evidenceId: approved.evidenceId,
        milestoneId: approved.milestoneId,
        decision: "APPROVED",
        comment: "site inspection accepted",
      },
    });
  });

  it("preserves REJECTED exactly", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      data: { attestation: attestationRecord({ decision: "REJECTED" }) },
      meta: {},
    });
    const result = await createAttestation({
      evidenceId: approved.evidenceId,
      milestoneId: approved.milestoneId,
      decision: "REJECTED",
    });
    expect(result.decision).toBe("REJECTED");
    expect(result.decision).not.toBe("MISMATCH");
  });

  it("rejects a response without the data envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ attestation: approved });
    await expect(
      createAttestation({
        evidenceId: approved.evidenceId,
        milestoneId: approved.milestoneId,
        decision: "APPROVED",
      }),
    ).rejects.toThrow("The attestation response is not in a known format.");
  });
});
