import { screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getContractorPassport,
  listContractors,
} from "../features/contractors/api/contractorsApi";
import { parseContractorPassport } from "../features/contractors/types";
import { listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { contractorPassportFixture } from "./fixtures";
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

function signIn() {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: "user-1",
    email: "client@example.com",
    fullName: "Demo Client",
    role: "CLIENT",
  });
}

const verifiedProject = () => {
  const base = contractorPassportFixture();
  return base.projects[0];
};

function activeProject() {
  const project = verifiedProject();
  return {
    ...project,
    id: "project-2",
    name: "Culvert works",
    milestoneStatus: {
      total: 1,
      byStatus: { PENDING: 0, IN_PROGRESS: 1, PENDING_VERIFICATION: 0, VERIFIED: 0, REJECTED: 0 },
      allVerified: false,
      withUnverified: true,
    },
    milestones: project.milestones.map((milestone) => ({
      ...milestone,
      id: "milestone-2",
      status: "IN_PROGRESS",
    })),
  };
}

function passportWithSplit() {
  const finished = verifiedProject();
  const active = activeProject();
  return contractorPassportFixture({
    projects: [finished, active],
    verifiedHistory: [finished],
    activeProjects: [active],
    totals: {
      ...contractorPassportFixture().totals,
      projects: 2,
      projectsWithAllMilestonesVerified: 1,
      verifiedHistory: 1,
      activeProjects: 1,
    },
    scope: {
      ...contractorPassportFixture().scope,
      contractorProjectCount: 2,
      verifiedHistoryBasis:
        "A project belongs to verifiedHistory only when every milestone it owns has status VERIFIED.",
    },
  });
}

describe("passport verified history and active projects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn();
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(listProjects).mockResolvedValue([]);
  });

  it("separates verified history from projects still in progress", async () => {
    vi.mocked(getContractorPassport).mockResolvedValue(passportWithSplit());
    renderApp("/contractors/c1/passport");

    const history = await screen.findByRole("region", { name: "Verified history" });
    const active = screen.getByRole("region", { name: "Active projects" });

    // Each project appears under exactly one heading.
    expect(within(history).getByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(within(active).getByRole("heading", { name: "Culvert works" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open project Passport" })).toHaveLength(2);
  });

  it("states that verified history rests only on milestone verification", async () => {
    vi.mocked(getContractorPassport).mockResolvedValue(passportWithSplit());
    renderApp("/contractors/c1/passport");

    const history = await screen.findByRole("region", { name: "Verified history" });

    expect(
      within(history).getByText(/every milestone it owns has status VERIFIED/i),
    ).toBeInTheDocument();
    const active = screen.getByRole("region", { name: "Active projects" });
    expect(
      within(active).getByText(/still in progress, awaiting review/i),
    ).toBeInTheDocument();
  });

  it("never presents a rating, rank or recommendation", async () => {
    vi.mocked(getContractorPassport).mockResolvedValue(passportWithSplit());
    renderApp("/contractors/c1/passport");

    await screen.findByRole("region", { name: "Verified history" });
    expect(
      screen.queryByText(/Trust Score|reputation score|ranked|recommended contractor|star rating/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/contains no\s+rating, score, ranking or recommendation/i)).toBeInTheDocument();
  });

  it("falls back to a single list when the server sends no split", async () => {
    // The default fixture carries no verifiedHistory/activeProjects.
    vi.mocked(getContractorPassport).mockResolvedValue(contractorPassportFixture());
    renderApp("/contractors/c1/passport");

    expect(await screen.findByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Verified history" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Active projects" })).not.toBeInTheDocument();
  });
});

describe("passport split parsing", () => {
  it("keeps the split optional so an older response still parses", () => {
    const { verifiedHistory, activeProjects, ...rest } = passportWithSplit();
    expect(verifiedHistory).toHaveLength(1);
    expect(activeProjects).toHaveLength(1);

    const legacy = { ...rest, totals: { ...rest.totals } };
    delete (legacy.totals as { verifiedHistory?: number }).verifiedHistory;
    delete (legacy.totals as { activeProjects?: number }).activeProjects;
    delete (legacy.scope as { verifiedHistoryBasis?: string }).verifiedHistoryBasis;

    const parsed = parseContractorPassport(legacy);
    expect(parsed).not.toBeNull();
    expect(parsed?.projects).toHaveLength(2);
    expect(parsed?.verifiedHistory).toBeUndefined();
    expect(parsed?.activeProjects).toBeUndefined();
  });

  it("reads the split when the server sends it", () => {
    const parsed = parseContractorPassport(JSON.parse(JSON.stringify(passportWithSplit())));
    expect(parsed?.verifiedHistory?.map((project) => project.id)).toEqual(["project-1"]);
    expect(parsed?.activeProjects?.map((project) => project.id)).toEqual(["project-2"]);
    expect(parsed?.totals.verifiedHistory).toBe(1);
    expect(parsed?.totals.activeProjects).toBe(1);
    expect(parsed?.scope.verifiedHistoryBasis).toMatch(/VERIFIED/);
  });

  it("rejects the response when the split holds an unreadable project", () => {
    const broken = JSON.parse(JSON.stringify(passportWithSplit()));
    broken.verifiedHistory = [{ id: "not-a-project" }];
    expect(parseContractorPassport(broken)).toBeNull();
  });
});