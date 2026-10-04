import { render, screen, within } from "@testing-library/react";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRouter } from "../app/router";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { authApi } from "../services/api/auth";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(),
  getContractor: vi.fn(),
  searchContractorsByCrbRegistrationNumber: vi.fn(),
  getContractorPassport: vi.fn(),
  getOwnContractorPassport: vi.fn(),
}));

function renderLanding(path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRouter />
    </MemoryRouter>,
  );
}

describe("public landing page", () => {
  // Only the hand-off tests below reach the contractors feature, and only the
  // existing contractor list call is involved. Nothing on the landing page
  // searches on its own.
  beforeEach(() => {
    vi.mocked(listContractors).mockResolvedValue([]);
  });

  it("leads with the client workflow and asks for the CRB registration number", () => {
    renderLanding();

    // Exactly one document heading, and it states the product in full.
    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Know the Contractor\. Verify the Project\. Keep the Proof\./i,
      }),
    ).toBeInTheDocument();

    // The client's first action is stated as a question they can answer.
    expect(screen.getByRole("heading", { name: "Find a Contractor" })).toBeInTheDocument();
    expect(screen.getByLabelText(/CRB Registration Number/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search Contractor/i })).toBeInTheDocument();

    // The discovery path is shown in order, not implied.
    expect(
      screen.getByRole("heading", { name: /From Contractor Discovery to Project History/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("The Client selects the contractor and creates the project.")).toBeInTheDocument();

    // Client ownership of project creation is explicit.
    expect(screen.getByText(/The client owns project creation and assignment/i)).toBeInTheDocument();
  });

  it("shows what the client reads before assigning a contractor", () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: "Contractor Passport" })).toBeInTheDocument();
    expect(screen.getByText(/A single, evolving record of a contractor's verified project history/i)).toBeInTheDocument();

    // Every illustrative value is labelled as a sample record.
    expect(screen.getAllByText("Sample record").length).toBeGreaterThan(0);

    // The preview reflects the shape of a real passport entry.
    expect(screen.getByText("ABC Builders Ltd")).toBeInTheDocument();
    expect(screen.getByText("CRB/1234/2024")).toBeInTheDocument();
    expect(screen.getByText("Road Rehabilitation Project")).toBeInTheDocument();
  });

  it("presents blockchain as the proof layer rather than the product", () => {
    renderLanding();

    expect(screen.getByRole("heading", { name: /Blockchain Provides the Proof Layer/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Blockchain proves that the recorded evidence matches the anchored cryptographic proof\. It does not independently prove that the construction work was truthful\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("SHA-256 hash")).toBeInTheDocument();
    expect(screen.getByText("Blockchain proof")).toBeInTheDocument();
  });

  it("states the four factual verification results and no judgement about a contractor", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Verification Should Answer a Factual Question/i }),
    ).toBeInTheDocument();
    for (const state of ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"]) {
      expect(screen.getByText(state)).toBeInTheDocument();
    }
    expect(screen.getByText(/not a judgement about a contractor/i)).toBeInTheDocument();
  });

  // The product records history. It does not score contractors, and a landing
  // page that implied otherwise would misdescribe the system.
  it("makes no claim about contractor quality, ratings or rankings", () => {
    renderLanding();

    expect(screen.queryByText(/\d(\.\d)?\s*\/\s*5/)).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /trustworthy|safe contractor|fraudulent contractor|best contractor|top rated|reputation score|trust score|\bstars?\b/i,
      ),
    ).not.toBeInTheDocument();
  });

  // The contractor is assigned work. The page must not invite a contractor to
  // create a project, because the client owns project creation.
  it("describes contractors as receiving assigned projects", () => {
    renderLanding();

    expect(
      screen.getByRole("heading", { name: /Give Completed Work a Verifiable History/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Contractors receive assigned projects, document project execution and build a verifiable history of completed work\./i,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/create your own project/i)).not.toBeInTheDocument();
  });

  it("links only to routes the application already serves", () => {
    renderLanding();

    // Sign in points at the existing login route.
    expect(screen.getAllByRole("link", { name: /Sign In/i }).length).toBeGreaterThan(0);
    for (const link of screen.getAllByRole("link", { name: /Sign In/i })) {
      expect(link).toHaveAttribute("href", "/login");
    }

    // Public verification points at the existing public verification route.
    expect(screen.getByRole("link", { name: /Verify a Proof/i })).toHaveAttribute("href", "/verify");

    // The passport entry point routes to the existing contractor discovery
    // screen rather than to a route that does not exist.
    expect(screen.getByRole("link", { name: /View Contractor Passport/i })).toHaveAttribute(
      "href",
      "/contractors",
    );
  });

  it("opens and closes its collapsible navigation", async () => {
    const user = userEvent.setup();
    renderLanding();

    const nav = screen.getByRole("navigation", { name: "Main navigation" });
    await user.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByRole("button", { name: "Close navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    await user.click(within(nav).getByRole("link", { name: "How It Works" }));
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  // The landing page must hand the typed CRB number to the existing discovery
  // screen rather than call an endpoint of its own, and must not present a
  // result it did not actually retrieve.
  it("carries the typed CRB number into the existing contractor discovery screen", async () => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-1",
      email: "client@example.com",
      fullName: "Demo Client",
      role: "CLIENT",
    });
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    renderApp("/");

    await user.type(screen.getByLabelText(/CRB Registration Number/i), "CRB/1234/2024");
    await user.click(screen.getByRole("button", { name: /Search Contractor/i }));

    // The number survives the hand-off, so the client does not retype it. The
    // field arrives prefilled and nothing is searched until it is submitted.
    const discoveryField = await screen.findByRole("textbox", {
      name: "Search by CRB Registration Number",
    });
    expect(discoveryField).toHaveValue("CRB/1234/2024");

    // The landing page has been left behind for the real discovery screen.
    expect(
      screen.queryByRole("heading", { level: 1, name: /Know the Contractor/i }),
    ).not.toBeInTheDocument();

    // The landing page issued no request of its own, on any endpoint.
    expect(fetchSpy.mock.calls.map((call) => String(call[0]))).toEqual([]);

    fetchSpy.mockRestore();
  });

  // The CRB field must not be a free-standing input that appears to accept an
  // empty search, and the discovery route keeps its existing sign-in gate.
  it("requires a number and sends a signed-out visitor to the existing sign-in gate", async () => {
    vi.mocked(authApi.me).mockResolvedValue(null);
    const user = userEvent.setup();
    renderApp("/");

    expect(screen.getByLabelText(/CRB Registration Number/i)).toBeRequired();

    await user.type(screen.getByLabelText(/CRB Registration Number/i), "CRB/1234/2024");
    await user.click(screen.getByRole("button", { name: /Search Contractor/i }));

    // /contractors sits inside the existing ProtectedRoute. That gate is
    // unchanged: an anonymous visitor must sign in before discovering anyone.
    expect(await screen.findByRole("heading", { name: "Sign in required" })).toBeInTheDocument();
  });

  // The hero is a background layer, so its binding lives in the stylesheet
  // rather than the DOM. Asserting only that the element exists would let the
  // page silently fall back to a flat panel, so the declared path is checked
  // against the asset actually on disk.
  it("binds the hero to a photograph that exists in public/images", () => {
    const css = readFileSync(resolve(process.cwd(), "src/pages/landing-page.css"), "utf8");
    // The quoted form is matched separately: these filenames contain
    // parentheses, so a `[^)]` character class would truncate the path.
    const declared = /--lp-hero-image:\s*url\(\s*(?:"([^"]*)"|'([^']*)'|([^"')]*))\s*\)/.exec(css);

    expect(declared).not.toBeNull();
    const heroPath = decodeURIComponent(declared?.[1] ?? declared?.[2] ?? declared?.[3] ?? "");
    expect(heroPath).not.toBe("none");
    expect(heroPath).toMatch(/^\/images\//);
    expect(existsSync(join(process.cwd(), "public", heroPath))).toBe(true);
  });

  // Every photograph rendered into the page must resolve to a real asset and
  // carry alt text, so a pasted filename cannot 404 in production.
  it("renders section photographs that exist and describe their section", () => {
    renderLanding();

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    for (const image of images) {
      const src = decodeURIComponent(image.getAttribute("src") ?? "");
      expect(src).toMatch(/^\/images\//);
      expect(existsSync(join(process.cwd(), "public", src))).toBe(true);
      expect(image).toHaveAccessibleName();
    }

    // Each photograph supports a different part of the client workflow.
    for (const id of ["find", "execution", "proof"]) {
      const section = document.querySelector(`#${id}`);
      expect(section).not.toBeNull();
      expect(within(section as HTMLElement).getByRole("img")).toBeInTheDocument();
    }
  });
});
