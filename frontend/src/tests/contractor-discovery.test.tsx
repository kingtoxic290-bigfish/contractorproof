import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  listContractors,
  searchContractorsByCrbRegistrationNumber,
} from "../features/contractors/api/contractorsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { contractorRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
  searchContractorsByCrbRegistrationNumber: vi.fn(),
  getContractorPassport: vi.fn(),
  getOwnContractorPassport: vi.fn(),
}));

const harbor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
  crbRegistrationNumber: "CRB-204",
});

function signInAs(role: "CLIENT" | "CONTRACTOR" | "AUDITOR") {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: role === "CONTRACTOR" ? "user-c1" : "user-1",
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Demo ${role}`,
    role,
  });
}

async function searchFor(user: ReturnType<typeof userEvent.setup>, registrationNumber: string) {
  await user.type(await screen.findByLabelText("Search by CRB Registration Number"), registrationNumber);
  await user.click(screen.getByRole("button", { name: "Search" }));
}

describe("contractor discovery by CRB Registration Number", () => {
  beforeEach(() => {
    signInAs("CLIENT");
    vi.mocked(listContractors).mockResolvedValue([]);
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([]);
  });

  it("states that the search key is the CRB Registration Number", async () => {
    renderApp("/contractors");
    expect(
      await screen.findByRole("textbox", { name: "Search by CRB Registration Number" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/does not replace or verify CRB registration/i).length,
    ).toBeGreaterThan(0);
  });

  it("returns the matching ContractorProof contractor for a CLIENT", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([harbor]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.getByText("CRB-204")).toBeInTheDocument();
    expect(searchContractorsByCrbRegistrationNumber).toHaveBeenCalledWith("CRB-204");
    expect(
      screen.getByRole("link", { name: "Open Contractor Passport" }),
    ).toHaveAttribute("href", "/contractors/c1/passport");
  });

  it("trims the registration number before searching", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([harbor]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "  CRB-204  ");

    await screen.findAllByText("Harbor Works Ltd");
    expect(searchContractorsByCrbRegistrationNumber).toHaveBeenCalledWith("CRB-204");
  });

  it("shows an empty not-found state for an unknown registration number", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-000");

    expect(
      await screen.findByText("No matching ContractorProof contractor."),
    ).toBeInTheDocument();
    expect(screen.getByText(/CRB-000/)).toBeInTheDocument();
    // An empty result is not an error, and it is not presented as a failure.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("distinguishes a failed search from an empty result", async () => {
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

  it("surfaces a forbidden discovery attempt without signing the user out", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockRejectedValue(
      new ApiError(403, "insufficient permission"),
    );

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
  });

  it("lets the search be cleared and repeated", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([harbor]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");
    await screen.findAllByText("Harbor Works Ltd");

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.queryByText("Harbor Works Ltd")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Search by CRB Registration Number"));
    await searchFor(user, "CRB-999");
    await screen.findByRole("button", { name: "Clear search" });
    expect(searchContractorsByCrbRegistrationNumber).toHaveBeenLastCalledWith("CRB-999");
  });
});
describe("discovery states leave no blank screen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signInAs("CLIENT");
    vi.mocked(listContractors).mockResolvedValue([]);
  });

  it("prompts for a CRB number before anything has been searched", async () => {
    renderApp("/contractors");

    expect(
      await screen.findByText(/Enter a CRB Registration Number to find a contractor/i),
    ).toBeInTheDocument();
  });

  it("reports an unavailable discovery service instead of rendering nothing", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockRejectedValue(
      new ApiError(501, "discovery is not available"),
    );

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-204");

    expect(
      await screen.findByText(/not available from the API yet/i),
    ).toBeInTheDocument();
  });

  it("still explains CRB's authority after an unknown number", async () => {
    vi.mocked(searchContractorsByCrbRegistrationNumber).mockResolvedValue([]);

    const user = userEvent.setup();
    renderApp("/contractors");
    await searchFor(user, "CRB-000");

    expect(
      await screen.findByText(/does not replace CRB registration/i),
    ).toBeInTheDocument();
  });
});
