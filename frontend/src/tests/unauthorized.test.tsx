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

describe("UnauthorizedPage", () => {
  it("explains that sign-in is required", async () => {
    renderApp("/unauthorized");

    expect(await screen.findByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
    expect(screen.getByText("You need to sign in to view this page.")).toBeInTheDocument();
  });
});
