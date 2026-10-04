import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getContractorPassport,
  getOwnContractorPassport,
  listContractors,
} from "../features/contractors/api/contractorsApi";
import { listCorrections } from "../features/corrections/api/correctionsApi";
import { listDisputes } from "../features/disputes/api/disputesApi";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import {
  getMilestone,
  listMilestoneHistory,
  listProjectMilestones,
  transitionMilestone,
} from "../features/milestones/api/milestonesApi";
import {
  assignProjectContractor,
  createProject,
  getProject,
  listProjects,
} from "../features/projects/api/projectsApi";
import { listAttestations } from "../features/verification/api/attestationApi";
import { authApi } from "../services/api/auth";
import { loadDashboard } from "../pages/dashboardApi";
import {
  contractorPassportFixture,
  contractorRecord,
  evidenceRecord,
  milestoneRecord,
  projectRecord,
} from "./fixtures";
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
  getMilestone: vi.fn(),
  listProjectMilestones: vi.fn(),
  createMilestone: vi.fn(),
  listMilestoneHistory: vi.fn(),
  transitionMilestone: vi.fn(),
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
  searchContractorsByCrbRegistrationNumber: vi.fn(),
  getContractorPassport: vi.fn(),
  getOwnContractorPassport: vi.fn(),
}));

vi.mock("../features/evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
  uploadEvidence: vi.fn(),
}));

vi.mock("../features/verification/api/attestationApi", () => ({
  listAttestations: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../features/corrections/api/correctionsApi", () => ({
  listCorrections: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../features/disputes/api/disputesApi", () => ({
  listDisputes: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../pages/dashboardApi", () => ({
  loadDashboard: vi.fn(),
}));

const PROJECT_ID = "88888888-8888-4888-8888-888888888888";
const MILESTONE_ID = "99999999-9999-4999-8999-999999999999";

const assignedContractor = contractorRecord({
  id: "contractor-1",
  legalName: "Harbor Works Ltd",
  crbRegistrationNumber: "CRB-204",
});

const replacementContractor = contractorRecord({
  id: "contractor-2",
  legalName: "Ridgeway Contractors Ltd",
});

const clientProject = projectRecord({
  id: PROJECT_ID,
  name: "Harbor bridge deck",
  clientName: "Demo Client",
  contractorId: assignedContractor.id,
  contractorName: assignedContractor.legalName,
});

const milestone = milestoneRecord({
  id: MILESTONE_ID,
  projectId: PROJECT_ID,
  name: "Deck pour",
  status: "IN_PROGRESS",
});

const evidence = evidenceRecord({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  milestoneId: MILESTONE_ID,
  fileName: "deck-pour.jpg",
});

function signIn(role: "CLIENT" | "CONTRACTOR" | "ADMIN") {
  vi.mocked(authApi.me).mockResolvedValue({
    id: role === "CONTRACTOR" ? assignedContractor.userId : `${role.toLowerCase()}-user`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Demo ${role}`,
    role,
  });
}

describe("role-based project access", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    vi.mocked(loadDashboard).mockResolvedValue([]);
    vi.mocked(listProjects).mockResolvedValue([clientProject]);
    vi.mocked(listContractors).mockResolvedValue([assignedContractor, replacementContractor]);
    vi.mocked(getProject).mockResolvedValue(clientProject);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);
    vi.mocked(getMilestone).mockResolvedValue(milestone);
    vi.mocked(listMilestoneHistory).mockResolvedValue([]);
    vi.mocked(listEvidence).mockResolvedValue([evidence]);
    vi.mocked(listAttestations).mockResolvedValue([]);
    vi.mocked(listCorrections).mockResolvedValue([]);
    vi.mocked(listDisputes).mockResolvedValue([]);
    vi.mocked(getContractorPassport).mockResolvedValue(
      contractorPassportFixture({
        contractor: {
          ...contractorPassportFixture().contractor,
          id: assignedContractor.id,
          legalName: assignedContractor.legalName,
        },
      }),
    );
    vi.mocked(getOwnContractorPassport).mockResolvedValue(contractorPassportFixture());
  });

  // CONTRACTOR: executes assigned work only. Creation and assignment are absent
  // from the rendered UI and unreachable by direct URL.
  describe("CONTRACTOR", () => {
    beforeEach(() => {
      signIn("CONTRACTOR");
    });

    it("shows assigned projects without any project creation entry point", async () => {
      renderApp("/projects");

      expect(await screen.findByRole("heading", { name: "My Assigned Projects" })).toBeInTheDocument();
      expect(await screen.findByText(clientProject.name)).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "New project" })).not.toBeInTheDocument();
      expect(screen.queryAllByRole("link", { name: /Create Project/i })).toHaveLength(0);
      // Application navigation must not offer creation either.
      expect(screen.queryByRole("link", { name: /Create Project/i })).not.toBeInTheDocument();
    });

    it("keeps the dashboard free of project creation calls to action", async () => {
      renderApp("/dashboard");

      expect(await screen.findByRole("heading", { name: "Contractor Work Dashboard" })).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Create Project/i })).not.toBeInTheDocument();
      expect(screen.getByRole("link", { name: /My Assigned Projects/i })).toBeInTheDocument();
    });

    it("renders no assignment controls on an assigned project", async () => {
      renderApp(`/projects/${PROJECT_ID}`);

      expect(await screen.findByText(clientProject.name)).toBeInTheDocument();
      expect(screen.queryByText("Assign Contractor")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Confirm Assignment" })).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Contractor")).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Create milestone" })).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: "Add milestone" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "View assigned contractor Passport" }),
      ).not.toBeInTheDocument();
    });

    it("renders no assignment controls on a contractor passport", async () => {
      renderApp(`/contractors/${assignedContractor.id}/passport`);

      expect(await screen.findByRole("heading", { name: "Contractor Passport" })).toBeInTheDocument();
      expect(screen.queryByText("Select Contractor")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Assign to project" })).not.toBeInTheDocument();
      expect(
        screen.queryByRole("link", { name: "Create a new project with this contractor" }),
      ).not.toBeInTheDocument();
    });

    it("is denied the project creation route by direct navigation", async () => {
      renderApp("/projects/new");

      expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Project name")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Create Project and Assign Contractor/i })).not.toBeInTheDocument();
      expect(createProject).not.toHaveBeenCalled();
    });

    it("is denied the milestone creation route by direct navigation", async () => {
      renderApp(`/projects/${PROJECT_ID}/milestones/new`);

      expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
      expect(screen.queryByLabelText("Milestone name")).not.toBeInTheDocument();
    });

    it("keeps milestone execution available on an assigned milestone", async () => {
      const user = userEvent.setup();
      vi.mocked(transitionMilestone).mockResolvedValue({
        milestone: { ...milestone, status: "PENDING_VERIFICATION" },
        historyEntry: {
          id: "history-new",
          milestoneId: MILESTONE_ID,
          previousStatus: "IN_PROGRESS",
          newStatus: "PENDING_VERIFICATION",
          actorName: "Demo CONTRACTOR",
          actorRole: "CONTRACTOR",
          evidenceId: evidence.id,
          isBaseline: false,
          reason: null,
          createdAt: "2026-09-09T09:00:00.000Z",
        },
      });

      renderApp(`/milestones/${MILESTONE_ID}`);

      await user.click(await screen.findByRole("button", { name: "Submit for verification" }));

      expect(transitionMilestone).toHaveBeenCalledWith(MILESTONE_ID, {
        status: "PENDING_VERIFICATION",
        evidenceId: evidence.id,
      });
      // Execution is not review: approval stays with the client.
      expect(screen.queryByRole("button", { name: "Approve submission" })).not.toBeInTheDocument();
    });

    it("keeps evidence submission available", async () => {
      renderApp(`/evidence?milestoneId=${MILESTONE_ID}`);

      expect(await screen.findByRole("heading", { name: "Upload evidence" })).toBeInTheDocument();
      expect(screen.getByText(/Attach a file to an existing milestone/)).toBeInTheDocument();
      expect(screen.getByLabelText("Project")).toBeInTheDocument();
      expect(screen.getByLabelText("Milestone")).toBeInTheDocument();
    });
  });

  // CLIENT: creates the project and assigns the contractor.
  describe("CLIENT", () => {
    beforeEach(() => {
      signIn("CLIENT");
    });

    it("is offered project creation in navigation and on the projects page", async () => {
      renderApp("/projects");

      expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
        "href",
        "/projects/new",
      );
      expect(screen.getByRole("link", { name: /Create Project/i })).toHaveAttribute(
        "href",
        "/projects/new",
      );
    });

    it("reaches the creation route and submits an assigned project", async () => {
      const user = userEvent.setup();
      vi.mocked(createProject).mockResolvedValue(clientProject);

      renderApp("/projects/new");

      await user.type(await screen.findByLabelText("Project name"), clientProject.name);
      await user.selectOptions(
        screen.getByLabelText("Assigned Contractor"),
        assignedContractor.id,
      );
      await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

      expect(createProject).toHaveBeenCalledWith({
        name: clientProject.name,
        contractorId: assignedContractor.id,
        description: undefined,
        contractStatus: undefined,
        nestContractReference: undefined,
        procuringEntity: undefined,
        contractStartDate: undefined,
        contractEndDate: undefined,
      });
      expect(
        await screen.findByText(`Project created and assigned to ${assignedContractor.legalName}.`),
      ).toBeInTheDocument();
      // The created project is reachable from the same flow.
      expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
        "href",
        `/projects/${PROJECT_ID}`,
      );
    });

    it("renders contractor assignment on a project it owns", async () => {
      const user = userEvent.setup();
      renderApp(`/projects/${PROJECT_ID}`);

      expect(await screen.findByText("Assign Contractor")).toBeInTheDocument();
      expect(screen.getByLabelText("Contractor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm Assignment" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Create milestone" })).toHaveAttribute(
        "href",
        `/projects/${PROJECT_ID}/milestones/new`,
      );

      // The panel drives the existing PATCH /projects/:id/contractor contract.
      vi.mocked(assignProjectContractor).mockResolvedValue({
        ...clientProject,
        contractorId: replacementContractor.id,
        contractorName: replacementContractor.legalName,
      });
      await user.selectOptions(
        screen.getByLabelText("Contractor"),
        replacementContractor.id,
      );
      await user.click(screen.getByRole("button", { name: "Confirm Assignment" }));

      expect(assignProjectContractor).toHaveBeenCalledWith(PROJECT_ID, replacementContractor.id);
      expect(
        await screen.findByText(`Project assigned to ${replacementContractor.legalName}.`),
      ).toBeInTheDocument();
    });

    it("links contractor discovery and passport to project creation", async () => {
      renderApp("/contractors");

      expect(await screen.findByRole("heading", { name: "Contractors" })).toBeInTheDocument();

      renderApp(`/contractors/${assignedContractor.id}/passport`);

      expect(await screen.findByText("Select Contractor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Assign to project" })).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: "Create a new project with this contractor" }),
      ).toHaveAttribute("href", `/projects/new?contractorId=${assignedContractor.id}`);
    });
  });

  // ADMIN: keeps the management access the backend already authorizes.
  describe("ADMIN", () => {
    beforeEach(() => {
      signIn("ADMIN");
    });

    it("retains project creation in navigation, on the projects page and by direct route", async () => {
      renderApp("/projects");

      expect(await screen.findByRole("heading", { name: "Projects" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "New project" })).toHaveAttribute(
        "href",
        "/projects/new",
      );
      expect(screen.getByRole("link", { name: /Create Project/i })).toHaveAttribute(
        "href",
        "/projects/new",
      );

      renderApp("/projects/new");

      expect(
        await screen.findByRole("button", { name: "Create Project and Assign Contractor" }),
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Assigned Contractor")).toBeInTheDocument();
    });

    it("retains contractor assignment and milestone management on a project", async () => {
      renderApp(`/projects/${PROJECT_ID}`);

      expect(await screen.findByText("Assign Contractor")).toBeInTheDocument();
      expect(screen.getByLabelText("Contractor")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Confirm Assignment" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Add milestone" })).toHaveAttribute(
        "href",
        `/projects/${PROJECT_ID}/milestones/new`,
      );
      expect(
        screen.getByRole("link", { name: "View assigned contractor Passport" }),
      ).toHaveAttribute("href", `/contractors/${assignedContractor.id}/passport`);
    });

    it("reaches the milestone creation route", async () => {
      renderApp(`/projects/${PROJECT_ID}/milestones/new`);

      expect(await screen.findByRole("heading", { name: "New milestone" })).toBeInTheDocument();
      expect(screen.getByLabelText("Milestone name")).toBeInTheDocument();
    });
  });
});