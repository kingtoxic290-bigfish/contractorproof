import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authApi } from "../services/api/auth";
import { hasSessionToken } from "../utils/session";
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

describe("logout", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
  });

  it("clears the session and returns to login", async () => {
    const user = userEvent.setup();
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Verification Dashboard" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(hasSessionToken()).toBe(false);
  });
});
