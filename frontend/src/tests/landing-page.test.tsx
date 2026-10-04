import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AppRouter } from "../app/router";

function renderLanding(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe("public landing page", () => {
  it("renders the client-owned workflow and factual proof explanation at the root", () => {
    renderLanding();
    expect(screen.getByRole("heading", { level: 1, name: /Build with confidence/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /From contractor discovery to verified project history/i })).toBeInTheDocument();
    expect(screen.getByText(/The client selects a contractor and creates the project/i)).toBeInTheDocument();
    expect(screen.getByText(/Project creation remains with the client/i)).toBeInTheDocument();
    expect(screen.getByText(/The blockchain stores the proof, not the documents/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Illustrative interface · sample data/i)).toHaveLength(2);
  });

  it("links to the existing sign-in and public verification routes", () => {
    renderLanding();
    expect(screen.getAllByRole("link", { name: /Sign in/i }).some((link) => link.getAttribute("href") === "/login")).toBe(true);
    expect(screen.getByRole("link", { name: /Open public verification/i })).toHaveAttribute("href", "/verify");
  });

  it("opens and closes its collapsible navigation", async () => {
    const user = userEvent.setup();
    renderLanding();
    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute("aria-expanded", "true");
    await user.click(within(nav).getByRole("link", { name: "How it works" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  });
});