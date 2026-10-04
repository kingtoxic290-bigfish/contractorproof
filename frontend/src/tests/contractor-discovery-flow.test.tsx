import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getContractorPassport,
  getOwnContractorPassport,
  listContractors,
  searchContractorsByCrbRegistrationNumber,
} from "../features/contractors/api/contractorsApi";
import { createProject, listProjects } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { contractorPassportFixture, contractorRecord, projectRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

/**
 * Client-facing contractor discovery flow.
 *
 * CRB search result -> Contractor Passport -> Select Contractor -> Create Project.
 * These tests assert what a client can actually see and act on, including that
 * internal identifiers are never presented as decision data.
 */
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

const PROJECT_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const harbor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
  crbRegistrationNumber: "CRB-204",
  crbCategory: "Works",
  crbType: "Building",
  crbClass: "Class I",
  crbStatus: "REGISTERED",
});

function signIn(role: "CLIENT" | "CONTRACTOR") {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: role === "CONTRACTOR" ? "user-c1" : "client-1",
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Demo ${role}`,
    role,
  });
}

async function searchFor(user: ReturnType<typeof userEvent.setup>, registrationNumber: string) {
  await user.type(
    await screen.findByRole("textbox", { name: "Search by CRB Registration Number" }),
    registrationNumber,
  );
  await user.click(screen.getByRole("button", { name: "Search" }));
}

describe("CRB contractor discovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("CLIENT");
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([harbor]);
  });

  it("presents the CRB Registration Number as the discovery key without claiming a live check", async () => {
    renderApp("/contractors");

    expect(
      await screen.findByRole("textbox", { name: "Search by CRB Registration Number" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search" })).toBeInTheDocument();
    expect(
      screen.getAllByText(/matches the number against its own contractor records/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText(/Enter a CRB Registration Number to find a contractor/i)).toBeInTheDocument();
  });

  it("shows a loading state while the search runs", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockReturnValue(new Promise(() => undefined));

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect(await screen.findByText("Searching contractor records...")).toBeInTheDocument();
  });

  it("renders the found contractor with the registration detail a client decides on", async () => {
    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect(await screen.findByRole("heading", { name: "Harbor Works Ltd" })).toBeInTheDocument();
    expect(screen.getByText("CRB-204")).toBeInTheDocument();
    expect(screen.getByText("REGISTERED")).toBeInTheDocument();
    expect(screen.getByText("Works")).toBeInTheDocument();
    expect(screen.getByText("Building")).toBeInTheDocument();
    expect(screen.getByText("Class I")).toBeInTheDocument();
    // Both drill-down targets are offered from the result.
    expect(screen.getByRole("link", { name: "Open Contractor Passport" })).toHaveAttribute(
      "href",
      "/contractors/c1/passport",
    );
    expect(screen.getByRole("link", { name: "View contractor" })).toHaveAttribute(
      "href",
      "/contractors/c1",
    );
    // The result states the next step instead of leaving the client at a dead end.
    expect(screen.getByText(/open the Contractor Passport to review/i)).toBeInTheDocument();
  });

  it("does not expose internal identifiers in the search result", async () => {
    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");
    await screen.findByRole("heading", { name: "Harbor Works Ltd" });

    expect(screen.queryByText("user-c1")).not.toBeInTheDocument();
    expect(screen.queryByText("c1@example.com")).not.toBeInTheDocument();
    expect(screen.queryByText(/user id/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Crb source")).not.toBeInTheDocument();
  });

  it("shows a no-results state for an unregistered CRB number", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-999");

    expect(
      await screen.findByText("No matching ContractorProof contractor."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error state distinct from an empty result", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockRejectedValue(
      new ApiError(500, "internal error"),
    );

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(
      screen.queryByText("No matching ContractorProof contractor."),
    ).not.toBeInTheDocument();
  });
});

describe("Contractor Passport as the client decision record", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("CLIENT");
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(getContractorPassport).mockResolvedValue(contractorPassportFixture());
    vi.mocked(getOwnContractorPassport).mockResolvedValue(contractorPassportFixture());
  });

  it("states who the contractor is and which CRB number identifies them", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByText("Harbor Works Ltd")).toBeInTheDocument();
    expect(screen.getByText("CRB-204")).toBeInTheDocument();
    expect(screen.getByText("REGISTERED")).toBeInTheDocument();
    // Factual record only: no score, rating or recommendation is introduced.
    expect(screen.getByText(/contains no\s+rating, score, ranking or recommendation/i)).toBeInTheDocument();
    expect(screen.queryByText(/Trust Score|reputation score|recommended contractor/i)).not.toBeInTheDocument();
  });

  it("shows the recorded project history with a drill-down to the project Passport", async () => {
    renderApp("/contractors/c1/passport");

    expect(await screen.findByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open project Passport" })).toHaveAttribute(
      "href",
      "/passports/project-1",
    );
    // The client-facing reference is shown; the raw project id stays in the link.
    expect(screen.getByText(/Project reference:/)).toBeInTheDocument();
    expect(screen.getByText("CT-204")).toBeInTheDocument();
    expect(screen.queryByText("project-1")).not.toBeInTheDocument();
  });

  it("offers a client the Select Contractor action carrying the contractor identity", async () => {
    renderApp("/contractors/c1/passport");

    const panel = await screen.findByRole("region", { name: "Select Contractor" });
    expect(
      within(panel).getByText("Harbor Works Ltd · CRB Registration Number CRB-204"),
    ).toBeInTheDocument();
    expect(
      within(panel).getByRole("link", { name: "Create a new project with this contractor" }),
    ).toHaveAttribute("href", "/projects/new?contractorId=c1");
  });

  it("keeps the client-only selection and creation actions away from a contractor", async () => {
    signIn("CONTRACTOR");
    vi.mocked(getContractorPassport).mockResolvedValue(
      contractorPassportFixture({
        scope: { ...contractorPassportFixture().scope, viewerRole: "CONTRACTOR" },
      }),
    );
    renderApp("/contractors/c1/passport");

    expect(await screen.findByText("CRB-204")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Select Contractor" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Create a new project with this contractor" }),
    ).not.toBeInTheDocument();
  });
});

describe("create project with the contractor carried from the Passport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("CLIENT");
    vi.mocked(listProjects).mockResolvedValue([]);
    vi.mocked(listContractors).mockResolvedValue([harbor]);
    vi.mocked(createProject).mockResolvedValue(
      projectRecord({ id: PROJECT_ID, name: "Harbor bridge deck", contractorId: harbor.id }),
    );
  });

  it("shows the assigned contractor identity before anything is submitted", async () => {
    renderApp("/projects/new?contractorId=c1");

    const select = (await screen.findByLabelText("Assigned Contractor")) as HTMLSelectElement;
    expect(select.value).toBe("c1");
    expect(
      await screen.findByText(
        "Harbor Works Ltd · CRB Registration Number CRB-204 · carried over from the Contractor Passport.",
      ),
    ).toBeInTheDocument();
  });

  it("creates the project with the carried contractor and confirms the result", async () => {
    const user = userEvent.setup();
    renderApp("/projects/new?contractorId=c1");

    await screen.findByLabelText("Assigned Contractor");
    await user.type(screen.getByLabelText("Project name"), "Harbor bridge deck");
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(createProject).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Harbor bridge deck", contractorId: "c1" }),
    );
    expect(
      await screen.findByText("Project created and assigned to Harbor Works Ltd."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      `/projects/${PROJECT_ID}`,
    );
  });

  it("states plainly when the carried contractor cannot be assigned by this account", async () => {
    renderApp("/projects/new?contractorId=contractor-not-in-list");

    expect(
      await screen.findByText(
        /contractor selected on the Contractor Passport is not in the list this account can assign/i,
      ),
    ).toBeInTheDocument();
  });
});