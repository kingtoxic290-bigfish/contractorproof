import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import { listProjectMilestones } from "../features/milestones/api/milestonesApi";
import {
  assignProjectContractor,
  createProject,
  getProject,
  listProjects,
} from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { contractorRecord, projectRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  assignProjectContractor: vi.fn(),
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

const PROJECT_ID = "44444444-4444-4444-8444-444444444444";

const assignedContractor = contractorRecord({
  id: "contractor-1",
  legalName: "Harbor Works Ltd",
  crbRegistrationNumber: "CRB-204",
});

const ownedProject = projectRecord({
  id: PROJECT_ID,
  name: "Harbor bridge deck",
  clientName: "Demo Client",
  contractorId: assignedContractor.id,
  contractorName: assignedContractor.legalName,
  contractorCrbRegistrationNumber: assignedContractor.crbRegistrationNumber,
  nestContractReference: "NEST-2026-0042",
  procuringEntity: "Demo Procuring Entity",
  contractStartDate: "2026-01-01T00:00:00.000Z",
  contractEndDate: "2026-12-31T00:00:00.000Z",
});

function signIn(role: "CLIENT" | "CONTRACTOR", id: string) {
  vi.mocked(authApi.me).mockResolvedValue({
    id,
    email: `${role.toLowerCase()}@example.com`,
    fullName: role === "CLIENT" ? "Demo Client" : "Demo Contractor",
    role,
  });
}

describe("Phase 4.3 assignment and project ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    vi.mocked(listContractors).mockResolvedValue([assignedContractor]);
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.mocked(listProjectMilestones).mockResolvedValue([]);
  });

  // CLIENT: sees contractor selection, starts creation, submits, sees the result.
  it("lets a CLIENT create a project for a selected contractor with the supported contract fields", async () => {
    const user = userEvent.setup();
    signIn("CLIENT", "client-1");
    vi.mocked(createProject).mockResolvedValue(ownedProject);

    renderApp("/projects/new");

    await screen.findByLabelText("Project name");
    await user.type(screen.getByLabelText("Project name"), "Harbor bridge deck");
    await user.type(screen.getByLabelText("Description"), "Deck replacement package");
    await user.type(screen.getByLabelText("Contract reference"), "NEST-2026-0042");
    await user.type(screen.getByLabelText("Procuring entity"), "Demo Procuring Entity");
    await user.type(screen.getByLabelText("Contract start date"), "2026-01-01");
    await user.type(screen.getByLabelText("Contract end date"), "2026-12-31");
    await user.selectOptions(screen.getByLabelText("Assigned Contractor"), assignedContractor.id);
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText(`Project created and assigned to ${assignedContractor.legalName}.`)).toBeInTheDocument();
    expect(vi.mocked(createProject)).toHaveBeenCalledWith({
      name: "Harbor bridge deck",
      contractorId: assignedContractor.id,
      description: "Deck replacement package",
      contractStatus: undefined,
      nestContractReference: "NEST-2026-0042",
      procuringEntity: "Demo Procuring Entity",
      contractStartDate: "2026-01-01",
      contractEndDate: "2026-12-31",
    });
  });

  it("requires a contractor before a project can be created", async () => {
    const user = userEvent.setup();
    signIn("CLIENT", "client-1");
    renderApp("/projects/new");

    await screen.findByLabelText("Project name");
    await user.type(screen.getByLabelText("Project name"), "Unassigned project");
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText("Select a contractor to assign to this project.")).toBeInTheDocument();
    expect(vi.mocked(createProject)).not.toHaveBeenCalled();
  });

  it("refuses contract dates that end before they start", async () => {
    const user = userEvent.setup();
    signIn("CLIENT", "client-1");
    renderApp("/projects/new");

    await screen.findByLabelText("Project name");
    await user.type(screen.getByLabelText("Project name"), "Reversed dates");
    await user.type(screen.getByLabelText("Contract start date"), "2026-12-31");
    await user.type(screen.getByLabelText("Contract end date"), "2026-01-01");
    await user.selectOptions(screen.getByLabelText("Assigned Contractor"), assignedContractor.id);
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText("The contract end date cannot be before the contract start date.")).toBeInTheDocument();
    expect(vi.mocked(createProject)).not.toHaveBeenCalled();
  });

  it("preselects the contractor carried over from the discovery and passport flow", async () => {
    signIn("CLIENT", "client-1");
    renderApp(`/projects/new?contractorId=${assignedContractor.id}`);

    const select = (await screen.findByLabelText("Assigned Contractor")) as HTMLSelectElement;
    expect(select.value).toBe(assignedContractor.id);
  });

  // CLIENT project detail identifies the assignment without implying ownership transfer.
  it("shows the assigned contractor with their CRB registration number on a client-owned project", async () => {
    signIn("CLIENT", "client-1");
    vi.mocked(getProject).mockResolvedValue(ownedProject);

    renderApp(`/projects/${PROJECT_ID}`);

    expect(await screen.findByText("Assigned contractor")).toBeInTheDocument();
    expect(screen.getAllByText(new RegExp(assignedContractor.legalName)).length).toBeGreaterThan(0);
    expect(screen.getByText("CRB CRB-204")).toBeInTheDocument();
    expect(
      screen.getByText(/The client owns this project relationship\./),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View assigned contractor Passport" })).toHaveAttribute(
      "href",
      `/contractors/${assignedContractor.id}/passport`,
    );
  });

  it("omits a CRB registration number the contractor has not recorded", async () => {
    signIn("CLIENT", "client-1");
    vi.mocked(getProject).mockResolvedValue({
      ...ownedProject,
      contractorCrbRegistrationNumber: null,
    });

    renderApp(`/projects/${PROJECT_ID}`);

    expect((await screen.findAllByText(new RegExp(assignedContractor.legalName))).length).toBeGreaterThan(0);
    expect(screen.queryByText(/^CRB /)).not.toBeInTheDocument();
  });

  it("lets the owning client reassign the contractor and shows the new assignment", async () => {
    const user = userEvent.setup();
    signIn("CLIENT", "client-1");
    const replacement = contractorRecord({
      id: "contractor-2",
      legalName: "Replacement Contractor Ltd",
      crbRegistrationNumber: "CRB-900",
    });
    vi.mocked(listContractors).mockResolvedValue([assignedContractor, replacement]);
    vi.mocked(getProject).mockResolvedValue(ownedProject);
    vi.mocked(assignProjectContractor).mockResolvedValue({
      ...ownedProject,
      contractorId: replacement.id,
      contractorName: replacement.legalName,
      contractorCrbRegistrationNumber: replacement.crbRegistrationNumber,
    });

    renderApp(`/projects/${PROJECT_ID}`);

    const select = await screen.findByLabelText("Contractor");
    await user.selectOptions(select, replacement.id);
    await user.click(screen.getByRole("button", { name: "Confirm Assignment" }));

    expect((await screen.findAllByText(new RegExp(replacement.legalName))).length).toBeGreaterThan(0);
    expect(vi.mocked(assignProjectContractor)).toHaveBeenCalledWith(PROJECT_ID, replacement.id);
  });

  // CONTRACTOR: sees only assigned work, never creation or assignment controls.
  it("shows a contractor only the projects assigned to them", async () => {
    signIn("CONTRACTOR", "contractor-user-1");
    vi.mocked(listProjects).mockResolvedValue([ownedProject]);

    renderApp("/projects");

    expect(await screen.findByRole("heading", { name: "My Assigned Projects" })).toBeInTheDocument();
    expect(await screen.findByText(ownedProject.name)).toBeInTheDocument();
    // The API is the filter: an unrelated project is never in the payload.
    expect(screen.queryByText("Somebody else's project")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New project" })).not.toBeInTheDocument();
  });

  it("keeps assignment and project creation controls away from a contractor on a project", async () => {
    signIn("CONTRACTOR", "contractor-user-1");
    vi.mocked(getProject).mockResolvedValue(ownedProject);

    renderApp(`/projects/${PROJECT_ID}`);

    expect(await screen.findByText("Assigned contractor")).toBeInTheDocument();
    expect(screen.queryByLabelText("Contractor")).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Create milestone" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "View assigned contractor Passport" })).not.toBeInTheDocument();
    expect(
      screen.getByText(/This project was assigned to your contractor account\./),
    ).toBeInTheDocument();
  });

  it("denies a contractor who navigates straight to project creation", async () => {
    signIn("CONTRACTOR", "contractor-user-1");
    renderApp("/projects/new");

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
    expect(vi.mocked(createProject)).not.toHaveBeenCalled();
  });
});
