import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { lookupCrb } from "../features/contractors/api/crbApi";
import { authApi } from "../services/api/auth";
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

vi.mock("../features/contractors/api/crbApi", () => ({
  lookupCrb: vi.fn(),
}));

describe("CRB lookup", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
    vi.mocked(listContractors).mockResolvedValue([]);
  });

  it("renders a synthetic lookup result", async () => {
    vi.mocked(lookupCrb).mockResolvedValue({
      notice: "Synthetic/demo CRB data. No live CRB API was called.",
      source: "SYNTHETIC_DEMO",
      found: true,
      crbRegistrationNumber: "CRB-DEMO-001",
      crbCategory: "Works",
      crbType: "Building",
      crbClass: "Class I",
      crbStatus: "ACTIVE",
      crbLastVerifiedAt: "2026-01-15T00:00:00.000Z",
    });

    const user = userEvent.setup();
    renderApp("/contractors");
    await user.type(await screen.findByLabelText("CRB registration number"), "CRB-DEMO-001");
    await user.click(screen.getByRole("button", { name: "Look up" }));

    expect(await screen.findByText("A synthetic record was found.")).toBeInTheDocument();
    expect(screen.getByText("SYNTHETIC_DEMO")).toBeInTheDocument();
    expect(screen.getByText("Works")).toBeInTheDocument();
  });
});
