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

describe("ForbiddenPage", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-1",
      email: "contractor@example.com",
      fullName: "Demo Contractor",
      role: "CONTRACTOR",
    });
  });

  it("blocks a contractor from the audit trail", async () => {
    renderApp("/audit");

    expect(await screen.findByRole("heading", { name: "You do not have access" })).toBeInTheDocument();
    expect(
      screen.getByText(/this area is not available for your role/i),
    ).toBeInTheDocument();
  });
});
