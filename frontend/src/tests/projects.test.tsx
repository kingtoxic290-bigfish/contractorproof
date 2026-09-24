import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectMilestones } from "../features/milestones/api/milestonesApi";
import { getProject, listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { milestoneRecord, projectRecord } from "./fixtures";
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
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
}));

const bridge = projectRecord({
  id: "p1",
  name: "Bridge deck",
  contractStatus: "ACTIVE",
});
const road = projectRecord({
  id: "p2",
  name: "Coastal road",
  contractStatus: "DRAFT",
});

describe("projects", () => {
  beforeEach(() => {
    seedSession();
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
    expect(await screen.findByText("No projects available.")).toBeInTheDocument();
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
    renderApp("/projects/p1");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(await screen.findByText("No milestones available.")).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
  });

  it("loads project milestones with exact status text", async () => {
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "m1", name: "Foundation", status: "FAILED", projectId: "p1" }),
    ]);
    renderApp("/projects/p1");
    expect(await screen.findByText("Foundation")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("shows a not-found state for a missing project", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(404, "project not found"));
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(404, "project not found"));
    renderApp("/projects/missing");
    expect((await screen.findAllByText("The requested record was not found.")).length).toBeGreaterThan(0);
  });
});
