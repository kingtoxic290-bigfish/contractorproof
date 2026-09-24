import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderApp } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

describe("protected routes", () => {
  it("sends signed-out users to the unauthorized page", async () => {
    renderApp("/dashboard");

    expect(await screen.findByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to login" })).toBeInTheDocument();
  });
});
