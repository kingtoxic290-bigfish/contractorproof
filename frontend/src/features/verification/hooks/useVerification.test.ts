import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../services/api/errors";
import { verificationRecord } from "../../../tests/fixtures";
import { createVerification } from "../api/verificationApi";
import { useVerification } from "./useVerification";

vi.mock("../api/verificationApi", () => ({
  createVerification: vi.fn(),
}));

const evidenceId = "11111111-1111-4111-8111-111111111111";

describe("useVerification", () => {
  beforeEach(() => {
    vi.mocked(createVerification).mockReset();
  });

  it("records MATCH without rewriting it to VERIFIED", async () => {
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "MATCH" }));
    const { result } = renderHook(() => useVerification());

    await act(async () => {
      await result.current.compare({ evidenceId });
    });

    expect(result.current.phase).toBe("recorded");
    expect(result.current.result?.status).toBe("MATCH");
    expect(result.current.result?.status).not.toBe("VERIFIED");
    expect(result.current.result?.status).not.toBe("PENDING_VERIFICATION");
  });

  it("keeps MISMATCH as MISMATCH", async () => {
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "MISMATCH" }));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.result?.status).toBe("MISMATCH");
    expect(result.current.result?.status).not.toBe("MATCH");
    expect(result.current.result?.status).not.toBe("FAILED");
  });

  it("keeps PENDING as PENDING", async () => {
    vi.mocked(createVerification).mockResolvedValue(
      verificationRecord({ status: "PENDING", id: null, sha256: null, createdAt: null }),
    );
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.result?.status).toBe("PENDING");
    expect(result.current.result?.status).not.toBe("MATCH");
  });

  it("keeps UNAVAILABLE as UNAVAILABLE", async () => {
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "UNAVAILABLE" }));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.result?.status).toBe("UNAVAILABLE");
    expect(result.current.result?.status).not.toBe("MATCH");
  });

  it("rejects a missing target before calling the API", async () => {
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({});
    });
    expect(result.current.phase).toBe("validation");
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("maps contractor self-verification 403 to forbidden", async () => {
    vi.mocked(createVerification).mockRejectedValue(
      new ApiError(403, "a contractor cannot verify or attest evidence", undefined, "FORBIDDEN"),
    );
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("forbidden");
    expect(result.current.error).toBe("a contractor cannot verify or attest evidence");
    expect(result.current.result).toBeNull();
  });

  it("maps 401 to unauthorized", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(401, "missing bearer token"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("unauthorized");
  });

  it("maps 404 to notfound", async () => {
    vi.mocked(createVerification).mockRejectedValue(
      new ApiError(404, "evidence not found", undefined, "EVIDENCE_NOT_FOUND"),
    );
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("notfound");
  });

  it("maps 409 to conflict", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(409, "conflict"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("conflict");
  });

  it("maps 422 to validation", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(422, "unprocessable"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("validation");
  });

  it("maps 500 to failed", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(500, "internal server error"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("failed");
    expect(result.current.result).toBeNull();
  });

  it("maps 503 to unavailable", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(503, "service unavailable"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("unavailable");
  });

  it("maps a network failure to failed", async () => {
    vi.mocked(createVerification).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useVerification());
    await act(async () => {
      await result.current.compare({ evidenceId });
    });
    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe("We couldn't reach the server. Please try again.");
  });
});
