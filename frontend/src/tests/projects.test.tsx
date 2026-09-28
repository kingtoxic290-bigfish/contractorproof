import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContractor, listContractors } from "../features/contractors/api/contractorsApi";
import { createProject, getProject, listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { contractorRecord, projectRecord } from "./fixtures";
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
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
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
const harbor = contractorRecord({ id: "c1", legalName: "Harbor Works Ltd" });

describe("projects", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(createProject).mockReset();
    vi.mocked(getProject).mockReset();
    vi.mocked(getContractor).mockReset();
  });

  it("shows a loading state", async () => {
    vi.mocked(listProjects).mockReturnValue(new Promise(() => undefined));
    renderApp("/projects");
    expect(await screen.findByText("Loading projects and contractor records...")).toBeInTheDocument();
  });

  it("renders one project and exact status text", async () => {
    vi.mocked(listProjects).mockResolvedValue([bridge]);
    renderApp("/projects");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getAllByText("ACTIVE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not supplied").length).toBeGreaterThan(0);
    expect(screen.queryByText(/98%/)).not.toBeInTheDocument();
  });

  it("renders multiple projects", async () => {
    vi.mocked(listProjects).mockResolvedValue([bridge, road]);
    renderApp("/projects");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getByText("Coastal road")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Bridge deck" })).toHaveAttribute("href", "/projects/p1");
    expect(screen.getByRole("link", { name: "Coastal road" })).toHaveAttribute("href", "/projects/p2");
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

  it("keeps a forbidden project list in an authorization state", async () => {
    vi.mocked(listProjects).mockRejectedValue(new ApiError(403, "insufficient permission"));
    renderApp("/projects");
    expect(await screen.findByText("You do not have permission to view this information.")).toBeInTheDocument();
  });

  it("renders project detail fields from the API", async () => {
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(getContractor).mockResolvedValue(harbor);
    renderApp("/projects/p1");
    expect(await screen.findByText("Bridge deck")).toBeInTheDocument();
    expect(screen.getByText("Harbor Works Ltd")).toBeInTheDocument();
    expect(screen.getAllByText("Not supplied").length).toBeGreaterThan(0);
    expect(getContractor).toHaveBeenCalledWith("contractor-1");
  });

  it("shows a not-found state for a missing project", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(404, "project not found"));
    renderApp("/projects/missing");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("shows a forbidden project detail without treating it as not found", async () => {
    vi.mocked(getProject).mockRejectedValue(new ApiError(403, "insufficient permission"));
    renderApp("/projects/p1");
    expect(await screen.findByText("You do not have permission to view this information.")).toBeInTheDocument();
    expect(screen.queryByText("The requested record was not found.")).not.toBeInTheDocument();
  });

  it("creates a contractor-owned project without submitting contractorId and navigates to detail", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    vi.mocked(createProject).mockResolvedValue(bridge);
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(getContractor).mockResolvedValue(harbor);
    renderApp("/projects/new");

    await user.type(await screen.findByLabelText("Project name *"), "Bridge deck");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(createProject).toHaveBeenCalledWith({ name: "Bridge deck" });
    expect(await screen.findByText("Project created successfully.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Project detail" })).toBeInTheDocument();
  });

  it("requires a project name before submitting", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    renderApp("/projects/new");

    await user.click(await screen.findByRole("button", { name: "Create project" }));

    expect(screen.getByText("Project name is required.")).toBeInTheDocument();
    expect(createProject).not.toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(String) }));
  });

  it("shows backend authorization and conflict errors on project creation", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    vi.mocked(createProject).mockRejectedValueOnce(new ApiError(403, "insufficient permission"));
    renderApp("/projects/new");
    await user.type(await screen.findByLabelText("Project name *"), "Bridge deck");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("backend did not authorize");

    vi.mocked(createProject).mockRejectedValueOnce(new ApiError(409, "project conflict"));
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("project conflict");
  });

  it("shows backend validation errors on project creation", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-contractor",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
    vi.mocked(createProject).mockRejectedValue(new ApiError(400, "contractStartDate must be an ISO date string"));
    renderApp("/projects/new");

    await user.type(await screen.findByLabelText("Project name *"), "Bridge deck");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("contractStartDate must be an ISO date string");
  });

  it("requires administrators to select a backend-returned contractor", async () => {
    const user = userEvent.setup();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-admin",
      email: "admin@example.com",
      fullName: "Demo Admin",
      role: "ADMIN",
    });
    vi.mocked(listContractors).mockResolvedValue([harbor]);
    vi.mocked(createProject).mockResolvedValue(bridge);
    vi.mocked(getProject).mockResolvedValue(bridge);
    vi.mocked(getContractor).mockResolvedValue(harbor);
    renderApp("/projects/new");

    await user.type(await screen.findByLabelText("Project name *"), "Bridge deck");
    await user.selectOptions(screen.getByLabelText("Contractor *"), "c1");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(createProject).toHaveBeenCalledWith({ name: "Bridge deck", contractorId: "c1" });
  });
});
