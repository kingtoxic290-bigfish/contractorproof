import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../services/api/errors";
import { evidenceRecord } from "../../../tests/fixtures";
import { uploadEvidence } from "../api/evidenceApi";
import { EVIDENCE_MAX_FILE_BYTES } from "../validation";
import { useEvidenceUpload } from "./useEvidenceUpload";

vi.mock("../api/evidenceApi", () => ({
  uploadEvidence: vi.fn(),
}));

const milestoneId = "22222222-2222-4222-8222-222222222222";
const jpeg = new File(["abc"], "site.jpg", { type: "image/jpeg" });
const created = evidenceRecord({
  id: "e1",
  fileName: "site.jpg",
  milestoneId,
});

describe("useEvidenceUpload", () => {
  beforeEach(() => {
    vi.mocked(uploadEvidence).mockReset();
  });

  it("records a successful upload as PENDING_VERIFICATION, not VERIFIED", async () => {
    vi.mocked(uploadEvidence).mockResolvedValue(created);
    const { result } = renderHook(() => useEvidenceUpload());

    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });

    expect(result.current.phase).toBe("uploaded");
    expect(result.current.result?.status).toBe("PENDING_VERIFICATION");
    expect(result.current.result?.verificationStatus).toBe("PENDING");
    expect(result.current.result?.status).not.toBe("VERIFIED");
  });

  it("exposes an uploading phase while the request is in flight", async () => {
    let finish: ((value: typeof created) => void) | undefined;
    vi.mocked(uploadEvidence).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const { result } = renderHook(() => useEvidenceUpload());

    let pending: Promise<unknown> | undefined;
    act(() => {
      pending = result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("uploading");
    await act(async () => {
      finish?.(created);
      await pending;
    });
    expect(result.current.phase).toBe("uploaded");
  });

  it("rejects an unsupported file type before calling the API", async () => {
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(
        milestoneId,
        new File(["abc"], "payload.exe", { type: "application/octet-stream" }),
      );
    });
    expect(result.current.phase).toBe("unsupported");
    expect(uploadEvidence).not.toHaveBeenCalled();
  });

  it("rejects an oversized file before calling the API", async () => {
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(
        milestoneId,
        new File([new Uint8Array(EVIDENCE_MAX_FILE_BYTES + 1)], "big.jpg", { type: "image/jpeg" }),
      );
    });
    expect(result.current.phase).toBe("too_large");
    expect(uploadEvidence).not.toHaveBeenCalled();
  });

  it("maps 401 to unauthorized", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(401, "missing bearer token"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("unauthorized");
    expect(result.current.phase).not.toBe("uploaded");
  });

  it("maps 403 to forbidden", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(403, "insufficient permission"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("forbidden");
    expect(result.current.error).toBe("You do not have permission to upload evidence.");
  });

  it("maps a missing milestone to not-found", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(404, "milestone not found"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("notfound");
    expect(result.current.error).toBe("The selected milestone was not found.");
  });

  it("surfaces backend upload validation errors", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(
      new ApiError(400, "file type does not match the file extension", undefined, "FILE_TYPE_NOT_ALLOWED"),
    );
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("unsupported");
    expect(result.current.error).toBe("file type does not match the file extension");
  });

  it("maps 409 to conflict", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(
      new ApiError(409, "an evidence version with this SHA-256 already exists", undefined, "HASH_CONFLICT"),
    );
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("conflict");
  });

  it("maps 422 to failed without becoming VERIFIED", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(422, "unprocessable"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("failed");
    expect(result.current.result).toBeNull();
  });

  it("maps 500 to failed", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(500, "internal server error"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("failed");
  });

  it("maps 503 to unavailable", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new ApiError(503, "service unavailable"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("unavailable");
  });

  it("maps a network failure to failed", async () => {
    vi.mocked(uploadEvidence).mockRejectedValue(new TypeError("Failed to fetch"));
    const { result } = renderHook(() => useEvidenceUpload());
    await act(async () => {
      await result.current.upload(milestoneId, jpeg);
    });
    expect(result.current.phase).toBe("failed");
    expect(result.current.error).toBe("We couldn't reach the server. Please try again.");
  });
});
