import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectMilestones } from "../features/milestones/api/milestonesApi";
import { assignProjectContractor, createProject, getProject, listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { contractorRecord, milestoneRecord, projectRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  assignProjectContractor: vi.fn(),
  listProjectLifecycleHistory: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
}));

vi.mock("../features/evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
}));

vi.mock("../features/evidence/hooks/useEvidence", () => ({
  useEvidence: vi.fn(() => ({ status: "success", records: [], error: null, retry: vi.fn() })),
}));

// The milestone execution summary counts recorded review events, and the
// lifecycle panel reads recorded lifecycle transitions. They are mocked here so
// the project page never reaches the network.
vi.mock("../features/verification/api/attestationApi", () => ({
  listAttestations: vi.fn(() => Promise.resolve([])),
  createAttestation: vi.fn(),
}));

vi.mock("../features/corrections/api/correctionsApi", () => ({
  listCorrections: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../features/disputes/api/disputesApi", () => ({
  listDisputes: vi.fn(() => Promise.resolve([])),
}));

const bridge = projectRecord({
  id: "11111111-1111-4111-8111-111111111111",
  name: "Bridge deck",
  contractStatus: "ACTIVE",
});
const road = projectRecord({
  id: "22222222-2222-4222-8222-222222222222",
  name: "Coastal road",
  contractStatus: "DRAFT",
});
const assignedContractor = contractorRecord({
  id: "contractor-1",
  legalName: "Harbor Works Ltd",
});
const replacementContractor = contractorRecord({
  id: "contractor-2",
  legalName: "Replacement Contractor Ltd",
});

describe("projects", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(listContractors).mockResolvedValue([assignedContractor]);
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
  });

  it("shows a loading state", async () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));
    renderApp("/projects");
    expect(await screen.findByText("Loading project information...")).toBeInTheDocument();
  });

  it("renders one project and exact status text", async () => {
    vi.mocked(listProjects).mockResolvedValue([bridge]);
    renderApp("/projects");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getAllByText("ACTIVE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.queryByText(/98%/)).not.toBeInTheDocument();
  });

  it("renders multiple projects", async () => {
    vi.mocked(listProjects).mockResolvedValue([bridge, road]);
    renderApp("/projects");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getByText("Coastal road")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "View project" })).toHaveLength(2);
  });

  it("shows an empty state", async () => {
    vi.mocked(listProjects).mockResolvedValue([]);
    renderApp("/projects");
    expect(await screen.findByText("No projects available for review.")).toBeInTheDocument();
  });

  it("shows an API error", async () => {
    vi.mocked(listProjects).mockRejectedValue(new ApiError(500, "internal server error"));
    renderApp("/projects");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("handles unauthorized access", async () => {
    vi.mocked(listProjects).mockRejectedValue(new ApiError(401, "missing bearer token"));
    renderApp("/projects");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });

  it("renders project detail fields from the API", async () => {
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(listProjectMilestones).mockResolvedValue([]);
    renderApp("/projects/11111111-1111-4111-8111-111111111111");
    expect((await screen.findAllByText("Bridge deck")).length).toBeGreaterThan(0);
    expect(await screen.findByText("No milestones available.")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View project Passport" })).toHaveAttribute("href", "/passports/11111111-1111-4111-8111-111111111111");
  });

  it("shows the assigned client to contractors and hides project-management controls", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "assigned-contractor-user",
      email: "contractor@example.com",
      fullName: "Assigned Contractor",
      role: "CONTRACTOR",
    });
    vi.mocked(getProject).mockResolvedValue({ ...bridge, clientName: "City Client" });
    vi.mocked(listProjectMilestones).mockResolvedValue([]);
    renderApp("/projects/11111111-1111-4111-8111-111111111111");

    expect((await screen.findAllByText("City Client")).length).toBeGreaterThan(0);
    expect(screen.getByText(/This project was assigned to your contractor account/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Manage milestones" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Project" })).not.toBeInTheDocument();
  });

  it("lets a client reassign a project contractor and refreshes from the backend result", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "client-1",
      email: "client@example.com",
      fullName: "Demo Client",
      role: "CLIENT",
    });
    vi.mocked(listContractors).mockResolvedValue([assignedContractor, replacementContractor]);
    const reassigned = { ...bridge, contractorId: replacementContractor.id, contractorName: replacementContractor.legalName };
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(assignProjectContractor).mockResolvedValue(reassigned);
    renderApp("/projects/11111111-1111-4111-8111-111111111111");

    await screen.findByRole("option", { name: /Replacement Contractor Ltd/ });
    await user.selectOptions(screen.getByLabelText("Contractor"), replacementContractor.id);
    await user.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    expect(assignProjectContractor).toHaveBeenCalledWith("11111111-1111-4111-8111-111111111111", replacementContractor.id);
    expect(await screen.findByText("Project assigned to Replacement Contractor Ltd.")).toBeInTheDocument();
    expect(await screen.findByText(/Replacement Contractor Ltd · contractor-2/)).toBeInTheDocument();
  });

  it("loads project milestones with exact status text", async () => {
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "11111111-1111-4111-8111-111111111111", name: "Foundation", status: "FAILED", projectId: "11111111-1111-4111-8111-111111111111" }),
    ]);
    renderApp("/projects/11111111-1111-4111-8111-111111111111");
    expect((await screen.findAllByText("Foundation")).length).toBeGreaterThan(0);
    // Scoped to this milestone's own card. Elsewhere on the page the lifecycle
    // panel labels its execution-readiness counts, which legitimately uses the
    // word "Verified" without describing this milestone.
    const milestone = (await screen.findAllByText("Foundation"))[0].closest("li");
    expect(milestone).not.toBeNull();
    const card = within(milestone as HTMLElement);
    expect(card.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(card.queryByText("Verified")).not.toBeInTheDocument();
    expect(card.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("creates a project from the backend-backed form", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-3",
      email: "contractor@example.com",
      fullName: "Demo Client",
      role: "CLIENT",
    });
    vi.mocked(createProject).mockResolvedValue({
      ...bridge,
      id: "33333333-3333-4333-8333-333333333333",
      name: "New bridge",
    });
    renderApp("/projects/new");

    await screen.findByLabelText("Project name");
    await user.type(screen.getByLabelText("Project name"), "New bridge");
    await user.type(screen.getByLabelText("Description"), "Bridge description");
    await user.selectOptions(screen.getByLabelText("Assigned Contractor"), "contractor-1");
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText("Project created and assigned to Harbor Works Ltd.")).toBeInTheDocument();
    expect(vi.mocked(createProject)).toHaveBeenCalledWith({
      name: "New bridge",
      contractorId: "contractor-1",
      description: "Bridge description",
    });
  });

  it("shows a validation error when the project name is missing", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-3",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CLIENT",
    });
    renderApp("/projects/new");

    await screen.findByRole("button", { name: "Create Project and Assign Contractor" });
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText("Project name is required.")).toBeInTheDocument();
  });

  it("does not expose project creation to a contractor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-4",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    renderApp("/projects");

    expect(await screen.findByRole("heading", { name: "My Assigned Projects" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New project" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create Project" })).not.toBeInTheDocument();
  });

  it("blocks a contractor who navigates directly to project creation", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-5",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    renderApp("/projects/new");

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
  });

  it("shows a not-found state for a missing project", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(404, "project not found"));
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(404, "project not found"));
    renderApp("/projects/missing");
    expect((await screen.findAllByText("The requested record was not found.")).length).toBeGreaterThan(0);
  });
});
