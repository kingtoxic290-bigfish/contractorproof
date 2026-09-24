import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { AppProviders } from "../app/providers/AppProviders";
import { LoginPage } from "../pages/LoginPage";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

describe("LoginPage", () => {
  it("renders the sign-in form", () => {
    render(
      <MemoryRouter>
        <AppProviders>
          <Routes>
            <Route path="/" element={<LoginPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
  });
});
