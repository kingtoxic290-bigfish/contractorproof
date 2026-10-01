import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { createAttestation } from "../features/verification/api/attestationApi";
import { createVerification } from "../features/verification/api/verificationApi";
import { listVerificationHistory, type VerificationHistoryEntry } from "../features/verification/api/verificationHistoryApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import {
  attestationRecord,
  evidenceRecord,
  verificationRecord,
} from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
  createEvidence: vi.fn(),
}));

vi.mock("../features/verification/api/verificationApi", () => ({
  createVerification: vi.fn(),
}));

vi.mock("../features/verification/api/verificationHistoryApi", () => ({
  listVerificationHistory: vi.fn(),
}));

vi.mock("../features/verification/api/attestationApi", () => ({
  createAttestation: vi.fn(),
}));

const milestoneId = "22222222-2222-4222-8222-222222222222";
const evidenceId = "11111111-1111-4111-8111-111111111111";
const versionId = "33333333-3333-4333-8333-333333333333";
const pending = evidenceRecord({
  id: evidenceId,
  fileName: "site.jpg",
  milestoneId,
  currentVersionId: versionId,
  status: "PENDING_VERIFICATION",
  verificationStatus: "PENDING",
  currentVersion: {
    id: versionId,
    evidenceId,
    versionNumber: 1,
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    fileName: "site.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 12,
    createdAt: "2026-09-24T07:49:43.000Z",
  },
});
const historicalMatch: VerificationHistoryEntry = {
  verification: {
    id: "history-1",
    status: "MATCH",
    source: "INTERNAL",
    createdAt: "2026-09-25T10:00:00.000Z",
  },
  projectId: "project-1",
  projectName: "Bridge deck",
  milestoneId,
  milestoneName: "Foundation",
  evidenceId,
  evidenceVersionId: versionId,
  versionNumber: 1,
  sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  proof: {
    id: "proof-1",
    eventType: "VERIFICATION",
    referenceId: versionId,
    txHash: "0xconfirmed-proof",
    blockNumber: 42,
    confirmationState: "CONFIRMED",
    confirmed: true,
    createdAt: "2026-09-25T10:01:00.000Z",
  },
};

function mockAuditor() {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: "auditor-1",
    email: "auditor@example.com",
    fullName: "Demo Auditor",
    role: "AUDITOR",
  });
}

function reviewPath(): string {
  return `/verification?evidenceId=${evidenceId}&milestoneId=${milestoneId}&evidenceVersionId=${versionId}`;
}

async function readyToReview() {
  expect(await screen.findByRole("heading", { name: "Evidence being reviewed" })).toBeInTheDocument();
  expect((await screen.findAllByText("site.jpg")).length).toBeGreaterThan(0);
}

describe("verification page", () => {
  beforeEach(() => {
    mockAuditor();
    vi.mocked(listEvidence).mockResolvedValue([pending]);
    vi.mocked(listVerificationHistory).mockResolvedValue([]);
    vi.mocked(createVerification).mockReset();
    vi.mocked(createAttestation).mockReset();
  });

  it("shows a loading state for the review queue", async () => {
    vi.mocked(listEvidence).mockReturnValue(new Promise(() => undefined));
    renderApp("/verification");
    expect(await screen.findByText("Loading evidence for review...")).toBeInTheDocument();
  });

  it("shows the backend-backed empty review queue", async () => {
    vi.mocked(listEvidence).mockResolvedValue([]);
    renderApp("/verification");
    expect(await screen.findByText("No evidence is currently available to review.")).toBeInTheDocument();
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("lists evidence for an authorized verifier without treating upload as verification", async () => {
    renderApp("/verification");
    expect(await screen.findByText("site.jpg")).toBeInTheDocument();
    expect(screen.getAllByText(/PENDING_VERIFICATION/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/PENDING/).length).toBeGreaterThan(0);
    expect(screen.getByText(pending.sha256)).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText(/99% verified|trust score|integrity score/i)).not.toBeInTheDocument();
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("lets a client inspect verification history and review evidence without initiating technical comparison", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "client-1",
      email: "client@example.com",
      fullName: "Project Client",
      role: "CLIENT",
    });
    vi.mocked(listVerificationHistory).mockResolvedValue([historicalMatch]);

    renderApp(reviewPath());

    expect(await screen.findByRole("heading", { name: "Verification" })).toBeInTheDocument();
    expect(await screen.findByText("Persisted verification history")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Human review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Record APPROVED attestation" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Compare stored fingerprint|Compare presented file/ })).not.toBeInTheDocument();
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("preserves FAILED and MISMATCH on listed evidence", async () => {
    vi.mocked(listEvidence).mockResolvedValue([
      evidenceRecord({
        id: evidenceId,
        fileName: "failed.jpg",
        milestoneId,
        status: "FAILED",
        verificationStatus: "MISMATCH",
      }),
    ]);
    renderApp("/verification");
    expect(await screen.findByText("failed.jpg")).toBeInTheDocument();
    expect(screen.getAllByText(/FAILED/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/MISMATCH/).length).toBeGreaterThan(0);
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
  });

  it("records MATCH for an authorized verifier after confirmation", async () => {
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "MATCH" }));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));

    expect(await screen.findByText("MATCH")).toBeInTheDocument();
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
    expect(
      screen.getByText(/does not mean the blockchain independently proves/i),
    ).toBeInTheDocument();
    expect(screen.getByText("Status: No proof")).toBeInTheDocument();
    expect(screen.queryByText("Status: Anchored")).not.toBeInTheDocument();
    expect(createVerification).toHaveBeenCalledWith({
      evidenceId,
      evidenceVersionId: pending.currentVersionId,
      file: undefined,
    });
  });

  it("shows the backend SHA-256 and copies that exact value", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "MATCH" }));
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));

    expect((await screen.findAllByText(verificationRecord({ status: "MATCH" }).sha256!)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Copy SHA-256" }));
    expect(writeText).toHaveBeenCalledWith(verificationRecord({ status: "MATCH" }).sha256);
    expect(await screen.findByText("SHA-256 copied.")).toBeInTheDocument();
  });

  it("clears a stale MATCH while a new verification is in progress", async () => {
    vi.mocked(createVerification).mockResolvedValueOnce(verificationRecord({ status: "MATCH" }));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("MATCH")).toBeInTheDocument();

    let resolveRequest: (value: ReturnType<typeof verificationRecord>) => void = () => undefined;
    vi.mocked(createVerification).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRequest = resolve; }),
    );
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("VERIFYING EVIDENCE")).toBeInTheDocument();
    expect(screen.queryByText("MATCH")).not.toBeInTheDocument();

    resolveRequest(verificationRecord({ status: "UNAVAILABLE" }));
    expect(await screen.findByText("UNAVAILABLE")).toBeInTheDocument();
  });

  it("shows minimal confirmed proof state returned with a MATCH", async () => {
    vi.mocked(createVerification).mockResolvedValue(
      verificationRecord({
        status: "MATCH",
        proof: {
          id: "proof-1",
          eventType: "VERIFICATION",
          txHash: "0xabc",
          blockNumber: 42,
          evidenceHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      }),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Status: Confirmed")).toBeInTheDocument();
    expect(screen.getByText("VERIFICATION")).toBeInTheDocument();
    expect(screen.getByText("0xabc")).toBeInTheDocument();
    expect(screen.getAllByText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").length).toBeGreaterThan(0);
  });

  it.each([
    [{ txHash: "0xpending", blockNumber: null }, "0xpending", "Not confirmed"],
    [{ txHash: null, blockNumber: 42 }, "Not provided", "42"],
    [{ txHash: "0xzero", blockNumber: 0 }, "0xzero", "0"],
  ])("does not present partial proof metadata as confirmed", async (proof, txLabel, blockLabel) => {
    vi.mocked(createVerification).mockResolvedValue(
      verificationRecord({ status: "MATCH", proof: { ...historicalMatch.proof!, ...proof } }),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Status: Pending")).toBeInTheDocument();
    expect(screen.getAllByText(txLabel).length).toBeGreaterThan(0);
    expect(screen.getByText(blockLabel)).toBeInTheDocument();
    expect(screen.queryByText("Status: Confirmed")).not.toBeInTheDocument();
  });

  it("renders persisted verification history with project, milestone, version, and confirmed proof context", async () => {
    vi.mocked(listVerificationHistory).mockResolvedValue([historicalMatch]);
    renderApp(reviewPath());

    expect(await screen.findByText("Persisted verification history")).toBeInTheDocument();
    expect(screen.getByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("history-1")).toBeInTheDocument();
    expect(screen.getByText("CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText("0xconfirmed-proof")).toBeInTheDocument();
  });

  it("shows no-history empty state for a selected evidence context", async () => {
    renderApp(reviewPath());
    expect(await screen.findByText("No verification results yet.")).toBeInTheDocument();
  });

  it("shows a loading state while the persisted verification projection loads", async () => {
    vi.mocked(listVerificationHistory).mockReturnValue(new Promise(() => undefined));
    renderApp(reviewPath());
    expect(await screen.findByText("Loading persisted verification history...")).toBeInTheDocument();
  });

  it("shows malformed persisted history as an explicit data error", async () => {
    vi.mocked(listVerificationHistory).mockRejectedValue(
      new Error("The dashboard response is not in a known format."),
    );
    renderApp(reviewPath());
    expect(await screen.findByText("The dashboard response is not in a known format.")).toBeInTheDocument();
  });

  it("shows malformed verification submission responses instead of a generic success or empty result", async () => {
    vi.mocked(createVerification).mockRejectedValue(
      new Error("The verification response is not in a known format."),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("The verification response is not in a known format.")).toBeInTheDocument();
  });

  it("keeps MISMATCH visually and semantically distinct", async () => {
    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "MISMATCH" }));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));

    expect(await screen.findByText("MISMATCH")).toBeInTheDocument();
    expect(
      screen.getAllByText(/does not match the recorded evidence fingerprint/i).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/fraud|fake|fraudulent/i)).not.toBeInTheDocument();
    expect(screen.queryByText("MATCH")).not.toBeInTheDocument();
  });

  it("keeps PENDING and UNAVAILABLE comparison results", async () => {
    vi.mocked(createVerification).mockResolvedValue(
      verificationRecord({ status: "PENDING", id: null, sha256: null }),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect((await screen.findAllByText("PENDING")).length).toBeGreaterThan(0);
    expect(screen.queryByText("MATCH")).not.toBeInTheDocument();

    vi.mocked(createVerification).mockResolvedValue(verificationRecord({ status: "UNAVAILABLE" }));
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("UNAVAILABLE")).toBeInTheDocument();
  });

  it("records an APPROVED attestation after confirmation", async () => {
    vi.mocked(createAttestation).mockResolvedValue(
      attestationRecord({ decision: "APPROVED", comment: "accepted" }),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Record APPROVED attestation" }));
    await user.click(screen.getByRole("button", { name: "Confirm APPROVED attestation" }));

    expect(await screen.findByText("Attestation recorded")).toBeInTheDocument();
    expect(screen.getByText("APPROVED")).toBeInTheDocument();
    expect(screen.getByText("AUDITOR")).toBeInTheDocument();
    expect(createAttestation).toHaveBeenCalledWith({
      evidenceId,
      milestoneId,
      decision: "APPROVED",
      comment: undefined,
    });
  });

  it("records REJECTED without calling it MISMATCH", async () => {
    vi.mocked(createAttestation).mockResolvedValue(attestationRecord({ decision: "REJECTED" }));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Record REJECTED attestation" }));
    await user.click(screen.getByRole("button", { name: "Confirm REJECTED attestation" }));
    expect(await screen.findByText("REJECTED")).toBeInTheDocument();
    expect(screen.queryByText("MISMATCH")).not.toBeInTheDocument();
  });

  it("sends a contractor away from the verification route", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-1",
      email: "contractor@example.com",
      fullName: "Harbor Works",
      role: "CONTRACTOR",
    });
    renderApp("/verification");
    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("keeps consultant engineers outside verification until project membership exists", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "consultant-1",
      email: "consultant@example.com",
      fullName: "Consultant Engineer",
      role: "CONSULTANT_ENGINEER",
    });
    renderApp("/verification");
    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(createVerification).not.toHaveBeenCalled();
  });

  it("handles unauthorized list access", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(401, "missing bearer token"));
    renderApp("/verification");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });

  it("handles a forbidden list as Forbidden, not a generic failure", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(403, "insufficient role"));
    renderApp("/verification");
    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
    expect(screen.queryByText("We couldn't load this information. Please try again.")).not.toBeInTheDocument();
  });

  it("shows Forbidden when compare is rejected by the API", async () => {
    vi.mocked(createVerification).mockRejectedValue(
      new ApiError(403, "insufficient permission", undefined, "FORBIDDEN"),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Forbidden")).toBeInTheDocument();
    expect(screen.getByText("insufficient permission")).toBeInTheDocument();
  });

  it("shows an authentication problem when compare is rejected with 401", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(401, "missing bearer token"));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
    expect(screen.getByText("You need to sign in to verify this evidence.")).toBeInTheDocument();
  });

  it("shows a safe validation message for a 400 compare error", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(400, "evidenceId or evidenceVersionId is required"));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Validation")).toBeInTheDocument();
    expect(screen.getByText("evidenceId or evidenceVersionId is required")).toBeInTheDocument();
  });

  it("handles a missing record on compare", async () => {
    vi.mocked(createVerification).mockRejectedValue(
      new ApiError(404, "evidence not found", undefined, "EVIDENCE_NOT_FOUND"),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Not found")).toBeInTheDocument();
    expect(screen.getByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("handles an attestation conflict", async () => {
    vi.mocked(createAttestation).mockRejectedValue(
      new ApiError(409, "this verifier has already attested this evidence", undefined, "CONFLICT"),
    );
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Record APPROVED attestation" }));
    await user.click(screen.getByRole("button", { name: "Confirm APPROVED attestation" }));
    expect(await screen.findByText("Conflict")).toBeInTheDocument();
    expect(screen.getByText("this verifier has already attested this evidence")).toBeInTheDocument();
  });

  it("handles an unprocessable compare", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(422, "unprocessable"));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByText("Validation")).toBeInTheDocument();
    expect(screen.getByText("The server could not accept this information.")).toBeInTheDocument();
  });

  it("handles a server error on compare", async () => {
    vi.mocked(createVerification).mockRejectedValue(new ApiError(500, "internal server error"));
    const user = userEvent.setup();
    renderApp(reviewPath());
    await readyToReview();
    await user.click(screen.getByRole("button", { name: "Compare stored fingerprint" }));
    await user.click(screen.getByRole("button", { name: "Confirm stored comparison" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
    expect(screen.queryByText("internal server error")).not.toBeInTheDocument();
  });

  it("handles a temporary outage on the review queue", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(503, "service unavailable"));
    renderApp("/verification");
    expect(await screen.findByText("The service is temporarily unavailable.")).toBeInTheDocument();
  });

  it("handles a network failure on the review queue", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp("/verification");
    expect(await screen.findByText("We couldn't reach the server. Please try again.")).toBeInTheDocument();
  });
});
