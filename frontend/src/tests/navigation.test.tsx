import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../services/api/auth";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
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
  });

  it("renders application navigation for an authenticated auditor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });

    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getAllByRole("navigation", { name: "Application" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: /Audit trail/i }).length).toBeGreaterThan(0);
  });

  it("hides audit navigation for a contractor", async () => {
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-1",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });

    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Audit trail/i })).not.toBeInTheDocument();
  });
});
