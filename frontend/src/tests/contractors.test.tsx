import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listContractors, getContractor } from "../features/contractors/api/contractorsApi";
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
}));

const harbor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
});
const quay = contractorRecord({
  id: "c2",
  legalName: "Quay Construction",
});

describe("contractors", () => {
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
    vi.mocked(listContractors).mockReturnValue(new Promise(() => undefined));
    renderApp("/contractors");
    expect(await screen.findByText("Loading contractor information...")).toBeInTheDocument();
  });

  it("renders one contractor from returned fields only", async () => {
    vi.mocked(listContractors).mockResolvedValue([harbor]);
    renderApp("/contractors");
    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "View contractor" })).toBeInTheDocument();
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.queryByText("98%")).not.toBeInTheDocument();
    expect(screen.queryByText("Trust Score")).not.toBeInTheDocument();
  });

  it("renders multiple contractors", async () => {
    vi.mocked(listContractors).mockResolvedValue([harbor, quay]);
    renderApp("/contractors");
    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Quay Construction").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "View contractor" })).toHaveLength(2);
  });

  it("shows an empty state when the API returns no records", async () => {
    vi.mocked(listContractors).mockResolvedValue([]);
    renderApp("/contractors");
    expect(await screen.findByText("No contractors available.")).toBeInTheDocument();
  });

  it("renders contractor detail from the unwrapped record", async () => {
    vi.mocked(getContractor).mockResolvedValue(harbor);
    renderApp("/contractors/c1");
    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("c1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Not provided").length).toBeGreaterThan(0);
    expect(screen.queryByText("Trust Score")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Contractor Passports" })).toHaveAttribute("href", "/passports");
  });

  it("shows a not-found state for a missing contractor", async () => {
    vi.mocked(getContractor).mockRejectedValue(new ApiError(404, "contractor not found"));
    renderApp("/contractors/missing");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("shows an API error with retry", async () => {
    vi.mocked(listContractors).mockRejectedValue(new ApiError(500, "internal server error"));
    renderApp("/contractors");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("handles a temporary service outage", async () => {
    vi.mocked(listContractors).mockRejectedValue(new ApiError(503, "service unavailable"));
    renderApp("/contractors");
    expect(await screen.findByText("The service is temporarily unavailable.")).toBeInTheDocument();
  });

  it("handles forbidden access", async () => {
    vi.mocked(listContractors).mockRejectedValue(new ApiError(403, "insufficient role"));
    renderApp("/contractors");
    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
  });

  it("handles unauthorized access", async () => {
    vi.mocked(listContractors).mockRejectedValue(new ApiError(401, "missing bearer token"));
    renderApp("/contractors");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });
});
