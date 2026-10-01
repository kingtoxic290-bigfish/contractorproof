import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  it("offers only client and contractor roles during public registration", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AppProviders>
          <Routes>
            <Route path="/" element={<LoginPage />} />
          </Routes>
        </AppProviders>
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Need an account?" }));
    const roleSelect = screen.getByRole("combobox", { name: "Role" });
    expect(Array.from((roleSelect as HTMLSelectElement).options).map((option) => option.value)).toEqual([
      "CLIENT",
      "CONTRACTOR",
    ]);
  });
});
