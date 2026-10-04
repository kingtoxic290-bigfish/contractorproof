import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getContractorPassport,
  getOwnContractorPassport,
  listContractors,
} from "../features/contractors/api/contractorsApi";
import { assignProjectContractor, listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { contractorPassportFixture, projectRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
  searchContractorsByCrbRegistrationNumber: vi.fn(),
  getContractorPassport: vi.fn(),
  getOwnContractorPassport: vi.fn(),
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  assignProjectContractor: vi.fn(),
}));

function signIn(role: "CLIENT" | "CONTRACTOR" | "AUDITOR") {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: role === "CONTRACTOR" ? "user-c1" : "user-1",
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Demo ${role}`,
    role,
  });
}

describe("live Contractor Passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("CLIENT");
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(getContractorPassport).mockResolvedValue(contractorPassportFixture());
    vi.mocked(getOwnContractorPassport).mockResolvedValue(contractorPassportFixture());
  });

  it("renders the contractor identity and CRB registration facts", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByText("CRB-204")).toBeInTheDocument();
    expect(screen.getByText("Harbor Works Ltd")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(screen.getByText("Class I")).toBeInTheDocument();
    expect(screen.getByText("Works")).toBeInTheDocument();
    expect(getContractorPassport).toHaveBeenCalledWith("c1");
  });

  it("presents project history, milestones and recorded outcomes", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Milestones (1)" })).toBeInTheDocument();
    expect(screen.getByText(/Foundation/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open project Passport" })).toHaveAttribute(
      "href",
      "/passports/project-1",
    );
  });

  it("states the milestone completion basis instead of inventing a rating", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByText(/every milestone it owns has status VERIFIED/i)).toBeInTheDocument();
    expect(screen.getByText(/contains no\s+rating, score, ranking or recommendation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Trust Score|reputation score|recommended contractor/i)).not.toBeInTheDocument();
  });

  it("shows the recorded CRB check history", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByText("CRB registration checks (1)")).toBeInTheDocument();
    expect(screen.getByText("REGISTERED")).toBeInTheDocument();
    expect(screen.getByText(/not judgements about the contractor/i)).toBeInTheDocument();
  });

  it("reports that no project history exists for a new contractor", async () => {
    vi.mocked(getContractorPassport).mockResolvedValue(
      contractorPassportFixture({
        projects: [],
        totals: {
          projects: 0,
          projectsWithAllMilestonesVerified: 0,
          projectsWithUnverifiedMilestones: 0,
          projectsWithoutMilestones: 0,
          milestones: { PENDING: 0, IN_PROGRESS: 0, PENDING_VERIFICATION: 0, VERIFIED: 0, REJECTED: 0 },
          evidence: { PENDING_VERIFICATION: 0, VERIFIED: 0, REJECTED: 0 },
          attestations: { APPROVED: 0, REJECTED: 0 },
          verification: { MATCH: 0, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 },
          disputes: { OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, REJECTED: 0 },
          corrections: { OPEN: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 },
          blockchainProofs: { total: 0, confirmed: 0, pending: 0 },
        },
      }),
    );

    renderApp("/contractors/c1/passport");
    expect(
      await screen.findByText("No project history has been recorded for this contractor."),
    ).toBeInTheDocument();
  });

  it("marks another client's project detail as withheld", async () => {
    const passport = contractorPassportFixture();
    passport.scope.withheldProjectDetailCount = 1;
    passport.projects[0] = {
      ...passport.projects[0],
      clientId: null,
      clientName: null,
      clientVisible: false,
      description: null,
    };
    vi.mocked(getContractorPassport).mockResolvedValue(passport);

    renderApp("/contractors/c1/passport");
    expect(
      await screen.findByText("Withheld — another client's project"),
    ).toBeInTheDocument();
    // Factual execution history stays visible so the client can decide.
    expect(screen.getByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
  });

  it("offers a CLIENT the Select Contractor action", async () => {
    vi.mocked(listProjects).mockResolvedValue([
      projectRecord({ id: "project-9", name: "New Build", contractorId: "c-other" }),
    ]);

    renderApp("/contractors/c1/passport");

    expect(
      await screen.findByRole("heading", { name: "Select Contractor" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Create a new project with this contractor" }),
    ).toHaveAttribute("href", "/projects/new?contractorId=c1");
  });

  it("assigns the contractor to an existing project through the existing endpoint", async () => {
    vi.mocked(listProjects).mockResolvedValue([
      projectRecord({ id: "project-9", name: "New Build", contractorId: "c-other" }),
    ]);
    vi.mocked(assignProjectContractor).mockResolvedValue(
      projectRecord({ id: "project-9", name: "New Build", contractorId: "c1", contractorName: "Harbor Works Ltd" }),
    );

    const user = userEvent.setup();
    renderApp("/contractors/c1/passport");

    // The project selector only becomes usable once the caller's projects load.
    await screen.findByRole("option", { name: /New Build/ });
    await user.selectOptions(screen.getByLabelText("Project"), "project-9");
    await user.click(screen.getByRole("button", { name: "Assign to project" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "New Build is now assigned to Harbor Works Ltd.",
    );
    expect(assignProjectContractor).toHaveBeenCalledWith("project-9", "c1");
  });

  it("does not offer the assignment action to a contractor", async () => {
    signIn("CONTRACTOR");
    renderApp("/contractors/c1/passport");

    await screen.findByText("CRB-204");
    expect(
      screen.queryByRole("heading", { name: "Select Contractor" }),
    ).not.toBeInTheDocument();
  });

  it("handles 403 and 401 on the passport without treating them the same", async () => {
    vi.mocked(getContractorPassport).mockRejectedValue(new ApiError(403, "forbidden"));
    const { unmount } = renderApp("/contractors/c1/passport");
    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
    unmount();

    vi.mocked(getContractorPassport).mockRejectedValue(new ApiError(401, "unauthenticated"));
    renderApp("/contractors/c1/passport");
    expect(
      await screen.findByText("You need to sign in to view this information."),
    ).toBeInTheDocument();
  });

  it("handles a missing passport record", async () => {
    vi.mocked(getContractorPassport).mockRejectedValue(new ApiError(404, "contractor not found"));
    renderApp("/contractors/c1/passport");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });
});

describe("own Contractor Passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("CONTRACTOR");
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(getOwnContractorPassport).mockResolvedValue(
      contractorPassportFixture({
        scope: { ...contractorPassportFixture().scope, viewerRole: "CONTRACTOR", isOwnPassport: true },
      }),
    );
  });

  it("resolves the contractor passport from the session", async () => {
    renderApp("/contractors/me/passport");

    expect(await screen.findByText("CRB-204")).toBeInTheDocument();
    expect(screen.getByText("Your own passport")).toBeInTheDocument();
    expect(getOwnContractorPassport).toHaveBeenCalled();
    expect(getContractorPassport).not.toHaveBeenCalled();
  });

  it("hides the Contractors discovery navigation from a contractor", async () => {
    renderApp("/contractors/me/passport");

    await screen.findByText("CRB-204");
    const navHrefs = screen
      .getAllByRole("navigation", { name: "Application" })
      .flatMap((nav) => within(nav).queryAllByRole("link"))
      .map((link) => link.getAttribute("href"));
    expect(navHrefs).toContain("/contractors/me/passport");
    expect(navHrefs).not.toContain("/contractors");
    expect(navHrefs).not.toContain("/projects/new");
  });
});