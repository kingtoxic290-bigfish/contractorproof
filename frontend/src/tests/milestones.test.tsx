import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMilestone,
  getMilestone,
  listProjectMilestones,
} from "../features/milestones/api/milestonesApi";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { getProject } from "../features/projects/api/projectsApi";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { milestoneRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
  getMilestone: vi.fn(),
  createMilestone: vi.fn(),
}));

vi.mock("../features/evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  getProject: vi.fn(),
  listProjects: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
}));

describe("milestones", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(getProject).mockResolvedValue({
      id: "p1",
      clientId: "client-1",
      clientName: "Demo Client",
      contractorId: "contractor-1",
      contractorName: "Assigned Contractor",
      name: "Foundation",
      description: null,
      nestTenderReference: null,
      nestContractReference: null,
      ocid: null,
      procuringEntity: null,
      contractStatus: "ACTIVE",
      contractStartDate: null,
      contractEndDate: null,
      nestSource: "SYNTHETIC_DEMO",
      createdAt: "2026-09-24T07:49:43.000Z",
      updatedAt: "2026-09-24T07:49:43.000Z",
    });
  });

  it("does not fetch until a project identifier is provided", async () => {
    renderApp("/milestones");
    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeInTheDocument();
    expect(listProjectMilestones).not.toHaveBeenCalled();
  });

  it("renders returned milestone status exactly", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "m1", name: "Foundation", status: "FAILED", projectId: "p1" }),
    ]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("Foundation")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getByText("Project p1")).toBeInTheDocument();
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("renders multiple milestone records", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "m1", name: "Foundation", status: "FAILED", projectId: "p1" }),
      milestoneRecord({ id: "m2", name: "Structure", status: "PENDING", projectId: "p1" }),
    ]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
  });

  it("shows an empty state", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("No milestones available.")).toBeInTheDocument();
  });

  it("shows an API error", async () => {
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(500, "internal server error"));
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it.each([
    [401, "You need to sign in to view this information."],
    [403, "You do not have permission to view this information."],
  ])("handles milestone list HTTP %i without changing the session", async (status, message) => {
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(status, "request rejected"));
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(authApi.me).toHaveBeenCalled();
  });

  it("shows a not-found state when the project is missing", async () => {
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(404, "project not found"));
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "missing");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("renders milestone detail from the existing endpoint and links to its evidence", async () => {
    const foundation = milestoneRecord({
      id: "m-detail",
      name: "Foundation",
      status: "PENDING",
      projectId: "p1",
    });
    vi.mocked(getMilestone).mockResolvedValue(foundation);
    renderApp("/milestones/m-detail");

    expect(await screen.findByRole("heading", { name: "Foundation" })).toBeInTheDocument();
    expect(getMilestone).toHaveBeenCalledWith("m-detail");
    expect(screen.getByRole("link", { name: "View milestone evidence" })).toHaveAttribute(
      "href",
      "/evidence?milestoneId=m-detail",
    );
    expect(await screen.findByText("No evidence uploaded yet.")).toBeInTheDocument();
    expect(listEvidence).toHaveBeenCalledWith({ milestoneId: "m-detail", projectId: undefined });
  });

  it.each([
    [401, "You need to sign in to view this information."],
    [403, "You do not have permission to view this information."],
    [404, "The requested record was not found."],
  ])("handles milestone detail HTTP %i", async (status, message) => {
    vi.mocked(getMilestone).mockRejectedValue(new ApiError(status, "request rejected"));
    renderApp("/milestones/m-detail");
    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it("validates milestone creation and submits through the project-scoped workflow", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CLIENT",
    });
    vi.mocked(createMilestone).mockResolvedValue(
      milestoneRecord({ id: "m-new", name: "Inspection", status: "PENDING", projectId: "p1" }),
    );
    renderApp("/projects/p1/milestones/new");

    await user.click(await screen.findByRole("button", { name: "Create milestone" }));
    expect(await screen.findByText("Milestone name is required.")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Milestone name"), "Inspection");
    await user.type(screen.getByLabelText("Description"), "Site inspection");
    await user.click(screen.getByRole("button", { name: "Create milestone" }));

    expect(await screen.findByRole("heading", { name: "Foundation" })).toBeInTheDocument();
    expect(getProject).toHaveBeenCalledWith("p1");
    expect(createMilestone).toHaveBeenCalledWith("p1", {
      name: "Inspection",
      description: "Site inspection",
    });
  });

  it("blocks contractors from directly opening milestone configuration", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    renderApp("/projects/p1/milestones/new");

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Milestone name")).not.toBeInTheDocument();
    expect(createMilestone).not.toHaveBeenCalled();
  });

  it("shows milestone creation authorization and not-found failures", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CLIENT",
    });
    vi.mocked(createMilestone).mockRejectedValueOnce(new ApiError(403, "insufficient permission"));
    renderApp("/projects/p1/milestones/new");
    await user.type(await screen.findByLabelText("Milestone name"), "Inspection");
    await user.click(screen.getByRole("button", { name: "Create milestone" }));
    expect(await screen.findByText("insufficient permission")).toBeInTheDocument();

    vi.mocked(createMilestone).mockRejectedValueOnce(new ApiError(404, "project not found"));
    await user.click(screen.getByRole("button", { name: "Create milestone" }));
    expect(await screen.findByText("project not found")).toBeInTheDocument();
  });
});
