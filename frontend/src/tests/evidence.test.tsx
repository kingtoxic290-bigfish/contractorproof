import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listEvidence,
  listEvidenceByMilestone,
  listEvidenceByProject,
  uploadEvidence,
} from "../features/evidence/api/evidenceApi";
import { getMilestone, listProjectMilestones } from "../features/milestones/api/milestonesApi";
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
  listEvidenceByProject: vi.fn(),
  listEvidenceByMilestone: vi.fn(),
  uploadEvidence: vi.fn(),
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
  getMilestone: vi.fn(),
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
  vi.mocked(getMilestone).mockResolvedValue(milestone);
}

describe("evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(await screen.findByRole("heading", { name: "site.jpg" })).toBeInTheDocument();
    expect(screen.getAllByText("PENDING_VERIFICATION").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getByText(pending.sha256)).toBeInTheDocument();
    expect(screen.getAllByText("Version 1").length).toBeGreaterThan(0);
    expect(screen.getByText(pending.id)).toBeInTheDocument();
    expect(screen.getByText(milestone.id)).toBeInTheDocument();
    expect(screen.getAllByText("image/jpeg · 12 bytes")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Copy SHA-256" })).toBeInTheDocument();
    expect(screen.getByText(pending.currentVersion!.id)).toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Blockchain verified")).not.toBeInTheDocument();
    expect(screen.queryByText(/integrity score/i)).not.toBeInTheDocument();
  });

  it("preserves backend workflow and verification statuses exactly", async () => {
    vi.mocked(listEvidence).mockResolvedValue([
      evidenceRecord({
        id: "e-failed",
        fileName: "failed.jpg",
        status: "REJECTED",
        verificationStatus: "MISMATCH",
      }),
    ]);
    renderApp("/evidence");
    expect(await screen.findByRole("heading", { name: "failed.jpg" })).toBeInTheDocument();
    expect(screen.getAllByText("REJECTED").length).toBeGreaterThan(0);
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

  it("loads evidence with a project-scoped request", async () => {
    vi.mocked(listEvidence).mockResolvedValue([pending]);
    renderApp(`/evidence?projectId=${project.id}`);

    expect(await screen.findByRole("heading", { name: "site.jpg" })).toBeInTheDocument();
    expect(listEvidence).toHaveBeenCalledWith({ projectId: project.id, milestoneId: undefined });
  });

  it("loads evidence with a milestone-scoped request", async () => {
    vi.mocked(listEvidence).mockResolvedValue([pending]);
    renderApp(`/evidence?milestoneId=${milestone.id}`);

    expect(await screen.findByRole("heading", { name: "site.jpg" })).toBeInTheDocument();
    expect(listEvidence).toHaveBeenCalledWith({ milestoneId: milestone.id, projectId: undefined });
  });

  it("does not broaden malformed URL filters into an unfiltered request", async () => {
    renderApp("/evidence?projectId=not-a-uuid");

    expect(await screen.findByRole("alert")).toHaveTextContent("Project identifier must be a valid UUID.");
    expect(listEvidence).not.toHaveBeenCalled();
  });

  it("uploads the selected file to the selected backend milestone and refreshes the list", async () => {
    const user = userEvent.setup();
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.mocked(uploadEvidence).mockResolvedValue(pending);
    renderApp(`/evidence?milestoneId=${milestone.id}`);

    const file = new File(["site evidence"], "site.jpg", { type: "image/jpeg" });
    await waitFor(() => expect(screen.getByLabelText("Milestone")).toHaveValue(milestone.id));
    await user.upload(await screen.findByLabelText("Evidence file"), file);
    expect(screen.getByText(/Selected site\.jpg/)).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Upload evidence" });
    expect(submit).toBeEnabled();
    await user.click(submit);

    expect(uploadEvidence).toHaveBeenCalledWith({ milestoneId: milestone.id, file });
    expect(await screen.findByText("The file was recorded as evidence.")).toBeInTheDocument();
    expect(screen.getByText(/Fingerprint comparison is PENDING/)).toBeInTheDocument();
    expect(screen.queryByText(/VERIFIED|TRUSTED|SAFE|RELIABLE/)).not.toBeInTheDocument();
    expect(listEvidence).toHaveBeenCalledTimes(2);
  });
});
