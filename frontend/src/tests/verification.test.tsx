import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { createAttestation } from "../features/verification/api/attestationApi";
import { createVerification } from "../features/verification/api/verificationApi";
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
    vi.mocked(createVerification).mockReset();
    vi.mocked(createAttestation).mockReset();
  });

  it("shows a loading state for the review queue", async () => {
    vi.mocked(listEvidence).mockReturnValue(new Promise(() => undefined));
    renderApp("/verification");
    expect(await screen.findByText("Loading evidence for review...")).toBeInTheDocument();
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
    expect(screen.getByText("Status: Blockchain proof unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Status: Anchored")).not.toBeInTheDocument();
    expect(createVerification).toHaveBeenCalledWith({
      evidenceId,
      evidenceVersionId: pending.currentVersionId,
      file: undefined,
    });
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
      screen.getByText(/does not match the expected integrity record/i),
    ).toBeInTheDocument();
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
    expect(await screen.findByRole("heading", { name: "You do not have access" })).toBeInTheDocument();
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
