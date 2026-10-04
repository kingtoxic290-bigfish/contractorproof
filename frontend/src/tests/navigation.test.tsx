import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../services/api/auth";
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

vi.mock("../services/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api/client")>();
  return {
    ...actual,
    getHealth: vi.fn().mockResolvedValue({ status: "ok", service: "contractorproof-api" }),
  };
});

describe("navigation", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(loadDashboard).mockResolvedValue([]);
  });

  it("renders application navigation for an authenticated auditor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });

    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Operations Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Application" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Verification/i }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: /Audit trail/i })).not.toBeInTheDocument();
  });

  it("hides audit navigation for a contractor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-1",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });

    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Contractor Work Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Audit trail/i })).not.toBeInTheDocument();
    // Contractor navigation names the same scope as the projects page: assigned
    // work, not ownership.
    expect(screen.getByRole("link", { name: /My Assigned Projects/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Create Project/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Contractors/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Verification/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Variations/i })).not.toBeInTheDocument();
    // The backend grants CORRECTION_READ / DISPUTE_READ to contractors for their
    // own records, so these pages are reachable rather than hidden.
    expect(screen.getByRole("link", { name: /Corrections/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Disputes/i })).toBeInTheDocument();
  });

  it("shows project management navigation to clients", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "client-1",
      email: "client@example.com",
      fullName: "Demo Client",
      role: "CLIENT",
    });
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Project Management Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Create Project/i })).toHaveLength(2);
    expect(screen.getByRole("link", { name: /Contractors/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verification/i })).toBeInTheDocument();
  });

  it.each(["AUDITOR", "PROCUREMENT_OFFICER"] as const)("allows %s to reach verification", async (role) => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "reviewer-1",
      email: "reviewer@example.com",
      fullName: "Internal Reviewer",
      role,
    });

    renderApp("/verification");

    expect(await screen.findByRole("heading", { name: "Verification" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Verification/i })).toBeInTheDocument();
  });

  it("shows public verification without authenticated project navigation", async () => {
    renderApp("/verify");

    expect(await screen.findByRole("heading", { name: "ContractorProof Verification" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Public verification" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Projects|Dashboard|Evidence/i })).not.toBeInTheDocument();
  });
});
