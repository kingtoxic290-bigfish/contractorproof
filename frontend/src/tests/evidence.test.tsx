import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { listProjectMilestones } from "../features/milestones/api/milestonesApi";
import { listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { evidenceRecord, milestoneRecord, projectRecord } from "./fixtures";
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
// createEvidence is exercised in useEvidenceUpload.test.ts

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
}));

const project = projectRecord({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bridge deck",
});
const milestone = milestoneRecord({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Foundation",
  status: "PENDING",
  projectId: project.id,
});
const pending = evidenceRecord({
  id: "e1",
  fileName: "site.jpg",
  milestoneId: milestone.id,
  status: "PENDING_VERIFICATION",
  verificationStatus: "PENDING",
});

function mockContractorSession() {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: "user-1",
    email: "contractor@example.com",
    fullName: "Harbor Works",
    role: "CONTRACTOR",
  });
  vi.mocked(listProjects).mockResolvedValue([project]);
  vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);
}

describe("evidence", () => {
  beforeEach(() => {
    mockContractorSession();
  });

  it("shows a loading state", async () => {
    vi.mocked(listEvidence).mockReturnValue(new Promise(() => undefined));
    renderApp("/evidence");
    expect(await screen.findByText("Loading evidence...")).toBeInTheDocument();
  });

  it("renders listed evidence with hash, version, and exact statuses", async () => {
    vi.mocked(listEvidence).mockResolvedValue([pending]);
    renderApp("/evidence");

    expect(await screen.findByText("site.jpg")).toBeInTheDocument();
    expect(screen.getAllByText("PENDING_VERIFICATION").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getByText(pending.sha256)).toBeInTheDocument();
    expect(screen.getAllByText("Version 1").length).toBeGreaterThan(0);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Blockchain verified")).not.toBeInTheDocument();
    expect(screen.queryByText(/integrity score/i)).not.toBeInTheDocument();
  });

  it("preserves a FAILED workflow status exactly", async () => {
    vi.mocked(listEvidence).mockResolvedValue([
      evidenceRecord({
        id: "e-failed",
        fileName: "failed.jpg",
        status: "FAILED",
        verificationStatus: "MISMATCH",
      }),
    ]);
    renderApp("/evidence");
    expect(await screen.findByText("failed.jpg")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MISMATCH").length).toBeGreaterThan(0);
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
  });

  it("shows an empty state", async () => {
    vi.mocked(listEvidence).mockResolvedValue([]);
    renderApp("/evidence");
    expect(await screen.findByText("No evidence uploaded yet.")).toBeInTheDocument();
  });

  it("handles unauthorized access", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(401, "missing bearer token"));
    renderApp("/evidence");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });

  it("handles forbidden access", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(403, "insufficient role"));
    renderApp("/evidence");
    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
  });

  it("handles a missing record", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(404, "evidence not found"));
    renderApp("/evidence");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("handles a conflict", async () => {
    vi.mocked(listEvidence).mockRejectedValue(
      new ApiError(409, "an evidence version with this SHA-256 already exists", undefined, "HASH_CONFLICT"),
    );
    renderApp("/evidence");
    expect(await screen.findByText("This request conflicts with an existing record.")).toBeInTheDocument();
  });

  it("handles an unprocessable request", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(422, "unprocessable"));
    renderApp("/evidence");
    expect(await screen.findByText("The server could not accept this information.")).toBeInTheDocument();
  });

  it("handles a server error", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(500, "internal server error"));
    renderApp("/evidence");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("handles a temporary outage", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new ApiError(503, "service unavailable"));
    renderApp("/evidence");
    expect(await screen.findByText("The service is temporarily unavailable.")).toBeInTheDocument();
  });

  it("handles a network failure", async () => {
    vi.mocked(listEvidence).mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp("/evidence");
    expect(await screen.findByText("We couldn't reach the server. Please try again.")).toBeInTheDocument();
  });

  it("shows the upload form in the Ready state for a contractor", async () => {
    vi.mocked(listEvidence).mockResolvedValue([]);
    renderApp(`/evidence?milestoneId=${milestone.id}`);
    expect(await screen.findByLabelText("Upload state: Ready")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence file")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload evidence" })).toBeDisabled();
  });
});
