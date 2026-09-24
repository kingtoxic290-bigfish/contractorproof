import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../services/api/errors";
import { attestationRecord } from "../../../tests/fixtures";
import { createAttestation } from "../api/attestationApi";
import { useAttestation } from "./useAttestation";

vi.mock("../api/attestationApi", () => ({
  createAttestation: vi.fn(),
}));

const evidenceId = "11111111-1111-4111-8111-111111111111";
const milestoneId = "22222222-2222-4222-8222-222222222222";

describe("useAttestation", () => {
  beforeEach(() => {
    vi.mocked(createAttestation).mockReset();
  });

  it("records APPROVED without rewriting it to MATCH or VERIFIED", async () => {
    vi.mocked(createAttestation).mockResolvedValue(attestationRecord({ decision: "APPROVED" }));
    const { result } = renderHook(() => useAttestation());
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("recorded");
    expect(result.current.result?.decision).toBe("APPROVED");
    expect(result.current.result?.decision).not.toBe("MATCH");
    expect(result.current.result?.decision).not.toBe("VERIFIED");
  });

  it("keeps REJECTED as REJECTED", async () => {
    vi.mocked(createAttestation).mockResolvedValue(attestationRecord({ decision: "REJECTED" }));
    const { result } = renderHook(() => useAttestation());
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "REJECTED" });
    });
    expect(result.current.result?.decision).toBe("REJECTED");
    expect(result.current.result?.decision).not.toBe("MISMATCH");
  });

  it("maps uploader self-attestation 403 to forbidden", async () => {
    vi.mocked(createAttestation).mockRejectedValue(
      new ApiError(403, "a user cannot attest evidence they uploaded", undefined, "UPLOADER_ATTEST_FORBIDDEN"),
    );
    const { result } = renderHook(() => useAttestation());
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("forbidden");
    expect(result.current.error).toBe("a user cannot attest evidence they uploaded");
  });

  it("maps 409 when the same verifier already attested", async () => {
    vi.mocked(createAttestation).mockRejectedValue(
      new ApiError(409, "this verifier has already attested this evidence", undefined, "CONFLICT"),
    );
    const { result } = renderHook(() => useAttestation());
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("conflict");
    expect(result.current.error).toBe("this verifier has already attested this evidence");
  });

  it("maps 401, 404, 422, 500, 503, and network failures", async () => {
    const { result } = renderHook(() => useAttestation());

    vi.mocked(createAttestation).mockRejectedValue(new ApiError(401, "missing bearer token"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("unauthorized");

    vi.mocked(createAttestation).mockRejectedValue(new ApiError(404, "evidence not found"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("notfound");

    vi.mocked(createAttestation).mockRejectedValue(new ApiError(422, "unprocessable"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("validation");

    vi.mocked(createAttestation).mockRejectedValue(new ApiError(500, "internal"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("failed");

    vi.mocked(createAttestation).mockRejectedValue(new ApiError(503, "unavailable"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("unavailable");

    vi.mocked(createAttestation).mockRejectedValue(new TypeError("Failed to fetch"));
    await act(async () => {
      await result.current.attest({ evidenceId, milestoneId, decision: "APPROVED" });
    });
    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe("We couldn't reach the server. Please try again.");
  });
});
