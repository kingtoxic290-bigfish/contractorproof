import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { loadDashboard } from "../pages/dashboardApi";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../pages/dashboardApi", () => ({
  loadDashboard: vi.fn(),
}));

const createdAt = "2026-09-20T09:30:00.000Z";

function passport(statuses: string[] = ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"]) {
  return {
    contractor: { id: "contractor-1", legalName: "Harbor Works Ltd" },
    project: {
      id: "project-1",
      contractorId: "contractor-1",
      name: "Harbor access road",
      contractStatus: "ACTIVE",
      createdAt,
    },
    milestones: [
      {
        id: "milestone-1",
        name: "Groundworks",
        status: "PENDING",
        createdAt,
        evidence: [
          {
            id: "evidence-1",
            milestoneId: "milestone-1",
            createdAt,
            versions: [
              {
                id: "version-1",
                versionNumber: 1,
                sha256: "a".repeat(64),
                createdAt,
                verificationStatus: statuses[statuses.length - 1] ?? null,
                verifications: statuses.map((status, index) => ({
                  id: `verification-${index}`,
                  status,
                  source: "UPLOAD",
                  createdAt: new Date(Date.parse(createdAt) + index * 1000).toISOString(),
                })),
              },
            ],
            attestations: [{ id: "attestation-1", decision: "APPROVED", createdAt }],
          },
        ],
      },
    ],
    blockchainProofs: [
      {
        id: "proof-confirmed",
        eventType: "VERIFICATION",
        referenceId: "version-1",
        txHash: "0x1234",
        blockNumber: 12,
        confirmationState: "CONFIRMED",
        confirmed: true,
        createdAt,
      },
      {
        id: "proof-pending",
        eventType: "ATTESTATION",
        referenceId: "attestation-1",
        txHash: null,
        blockNumber: null,
        confirmationState: "PENDING",
        confirmed: false,
        createdAt,
      },
    ],
  };
}

describe("verification dashboard", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "auditor-1",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
    vi.mocked(loadDashboard).mockReset();
  });

  it("renders real counts, project fields, verification states, activity and proof state", async () => {
    vi.mocked(loadDashboard).mockResolvedValue([passport()]);
    renderApp("/dashboard");

    expect((await screen.findAllByText("Harbor access road")).length).toBeGreaterThan(0);
    expect(screen.getByText("Harbor Works Ltd")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE")).toBeInTheDocument();
    expect(screen.getByText("Groundworks")).toBeInTheDocument();
    expect(screen.getAllByText("MATCH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("MISMATCH").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getAllByText("UNAVAILABLE").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Confirmed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Evidence evidence-1").length).toBeGreaterThan(0);
    expect(screen.getByText("4", { selector: "p" })).toBeInTheDocument();
    expect(screen.queryByText(/trust score|reputation|fraudulent|safe contractor/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open project" })).toHaveLength(3);
    for (const link of screen.getAllByRole("link", { name: "Open project" })) {
      expect(link).toHaveAttribute("href", "/projects/project-1");
    }
  });

  it("shows a genuine zero-data state only when the API returns an empty list", async () => {
    vi.mocked(loadDashboard).mockResolvedValue([]);
    renderApp("/dashboard");

    expect(await screen.findByText("No projects available.")).toBeInTheDocument();
    expect(screen.getByText("The backend returned no projects accessible to this account.")).toBeInTheDocument();
    expect(screen.getAllByText("0", { selector: "p" })).toHaveLength(5);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows an error rather than zero metrics when the API fails", async () => {
    vi.mocked(loadDashboard).mockRejectedValue(new ApiError(500, "internal server error"));
    renderApp("/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent("could not load dashboard records");
    expect(screen.queryByText("No projects available.")).not.toBeInTheDocument();
    expect(screen.queryByText("0", { selector: "p" })).not.toBeInTheDocument();
  });

  it("keeps forbidden users authenticated and explains the authorization state", async () => {
    vi.mocked(loadDashboard).mockRejectedValue(new ApiError(403, "insufficient permission"));
    renderApp("/dashboard");

    expect(await screen.findByRole("alert")).toHaveTextContent("did not authorize access");
    expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("shows an explicit expired-session message for unauthorized responses", async () => {
    vi.mocked(loadDashboard).mockRejectedValue(new ApiError(401, "unauthenticated"));
    renderApp("/dashboard");

    expect(await screen.findByText("Your sign-in session has expired. Sign in again to load dashboard records.")).toBeInTheDocument();
  });
});