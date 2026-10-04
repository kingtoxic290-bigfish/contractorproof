import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getOfficialPassports, getOfficialProjectPassport } from "../features/passports/api/passportsApi";
import { ApiError } from "../services/api/errors";
import { authApi } from "../services/api/auth";
import { passportFixture } from "./passportFixture";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

vi.mock("../features/passports/api/passportsApi", () => ({
  getOfficialPassports: vi.fn(),
  getOfficialProjectPassport: vi.fn(),
}));

function mockAuditor() {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: "auditor-1",
    email: "auditor@example.com",
    fullName: "Demo Auditor",
    role: "AUDITOR",
  });
}

describe("contractor passports", () => {
  beforeEach(() => {
    mockAuditor();
    vi.mocked(getOfficialPassports).mockResolvedValue([passportFixture]);
    vi.mocked(getOfficialProjectPassport).mockResolvedValue(passportFixture);
  });

  it("shows loading while the authorized Passport list is pending", async () => {
    vi.mocked(getOfficialPassports).mockReturnValue(new Promise(() => undefined));
    renderApp("/passports");
    expect(await screen.findByText("Loading project passports...")).toBeInTheDocument();
  });

  it("lists backend contractor and project records with a project Passport link", async () => {
    renderApp("/passports");
    expect(await screen.findByText("Harbor Works Ltd")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(screen.getByText("Project ID: project-1")).toBeInTheDocument();
    expect(screen.getByText(/Demo Procuring Entity/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open passport" })).toHaveAttribute("href", "/passports/project-1");
    expect(getOfficialPassports).toHaveBeenCalled();
  });

  it("shows an empty state for a successful empty passport list", async () => {
    vi.mocked(getOfficialPassports).mockResolvedValue([]);
    renderApp("/passports");
    expect(await screen.findByText("No passport records available.")).toBeInTheDocument();
  });

  it("renders contractor, project, milestones, and historical evidence versions", async () => {
    renderApp("/passports/project-1");
    expect(await screen.findByText("CRB-204")).toBeInTheDocument();
    expect(screen.getByText("CRB_LOOKUP")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Bridge deck" })).toBeInTheDocument();
    expect(screen.getByText("TN-204 / CT-204")).toBeInTheDocument();
    expect(screen.getAllByText("Foundation").length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence Version 1 · historical")).toBeInTheDocument();
    expect(screen.getByText("Evidence Version 2 · current")).toBeInTheDocument();
    expect(screen.getByText("Evidence evidence-1")).toBeInTheDocument();
    expect(getOfficialProjectPassport).toHaveBeenCalledWith("project-1");
  });

  it("shows complete SHA-256 values and offers accessible copy controls", async () => {
    renderApp("/passports/project-1");
    const hashes = await screen.findAllByText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(hashes.some((hash) => hash.classList.contains("break-all"))).toBe(true);
    expect(screen.getAllByRole("button", { name: "Copy SHA-256" }).length).toBeGreaterThan(0);
  });

  it("preserves all four canonical verification states as technical results", async () => {
    renderApp("/passports/project-1");
    for (const state of ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"]) {
      expect(await screen.findAllByText(state)).not.toHaveLength(0);
    }
    expect(screen.getByText("Verification MISMATCH")).toBeInTheDocument();
    expect(screen.queryByText(/fraudulent|dishonest|unsafe|untrustworthy/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/trusted contractor|Trust Score|reputation score/i)).not.toBeInTheDocument();
  });

  it("distinguishes confirmed, pending, and absent proof using transaction and block metadata", async () => {
    renderApp("/passports/project-1");
    expect((await screen.findAllByText("CONFIRMED")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getAllByText("NO PROOF").length).toBeGreaterThan(0);
    expect(screen.getAllByText("22").length).toBeGreaterThan(0);
    expect(screen.getAllByText(`0x${"1".repeat(64)}`).length).toBeGreaterThan(0);
    expect(screen.queryByText(/explorer|RPC|private key/i)).not.toBeInTheDocument();
  });

  it("renders only safe attestation fields returned by the Passport", async () => {
    renderApp("/passports/project-1");
    expect(await screen.findByText("Attestations (1)")).toBeInTheDocument();
    expect(screen.getAllByText("APPROVED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AUDITOR").length).toBeGreaterThan(0);
    expect(screen.getByText("attestation-1")).toBeInTheDocument();
    expect(screen.queryByText(/comment|verifierId/i)).not.toBeInTheDocument();
  });

  it("renders labeled NeST procurement provenance separately from CRB registration", async () => {
    renderApp("/passports/project-1");

    expect(await screen.findByRole("heading", { name: "PROCUREMENT · NeST" })).toBeInTheDocument();
    expect(screen.getByText("DEMO / SANDBOX")).toBeInTheDocument();
    expect(screen.getByText("DEMO: Works package one")).toBeInTheDocument();
    expect(screen.getByText("DEMO Public Works Unit")).toBeInTheDocument();
    expect(screen.getByText("Source: SANDBOX_DEMO:ocds-sandbox-001")).toBeInTheDocument();
    expect(screen.getByText(/Procurement information sourced from NeST/)).toBeInTheDocument();
    expect(screen.queryByText(/Contractor verified by NeST|trustworthy/i)).not.toBeInTheDocument();
  });

  it("preserves correction, variation snapshots, resolutions, and dated record history", async () => {
    renderApp("/passports/project-1");
    expect(await screen.findByText("Corrections (1)")).toBeInTheDocument();
    expect(screen.getByText("Corrected evidence versions")).toBeInTheDocument();
    expect(screen.getAllByText("Retain both evidence versions in the record.").length).toBeGreaterThan(0);
    expect(screen.getByText("Variation VAR-01")).toBeInTheDocument();
    expect(screen.getByText("Original state")).toBeInTheDocument();
    expect(screen.getByText(/Bridge deck revision/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Record history" })).toBeInTheDocument();
    expect(screen.getByText("Evidence version 1 recorded")).toBeInTheDocument();
    expect(screen.getByText("Variation resolution RESOLVED")).toBeInTheDocument();
  });

  it("keeps project detail content responsive-safe for long identifiers and hashes", async () => {
    renderApp("/passports/project-1");
    await screen.findByText("Harbor Works Ltd");
    expect(screen.getByText("project-1")).toHaveClass("break-all");
    expect(screen.getAllByText("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa").some((element) => element.classList.contains("break-all"))).toBe(true);
  });

  it("shows loading while an individual project Passport is pending", async () => {
    vi.mocked(getOfficialProjectPassport).mockReturnValue(new Promise(() => undefined));
    renderApp("/passports/project-1");
    expect(await screen.findByText("Loading contractor passport...")).toBeInTheDocument();
  });

  it("shows a genuine empty message when no nested history was returned", async () => {
    vi.mocked(getOfficialProjectPassport).mockResolvedValue({
      ...passportFixture,
      milestones: [],
      variations: [],
      blockchainProofs: [],
    });
    renderApp("/passports/project-1");
    expect(await screen.findByText("No milestones were returned in this Passport projection.")).toBeInTheDocument();
    expect(screen.getByText("No variation records were returned for this project.")).toBeInTheDocument();
    expect(screen.getByText("No blockchain proof events were returned for this project.")).toBeInTheDocument();
  });

  it("handles a 401 with sign-in-required behavior", async () => {
    vi.mocked(getOfficialProjectPassport).mockRejectedValue(new ApiError(401, "unauthenticated"));
    renderApp("/passports/project-1");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });

  it("handles a 403 as forbidden without treating it as a sign-out", async () => {
    vi.mocked(getOfficialProjectPassport).mockRejectedValue(new ApiError(403, "forbidden"));
    renderApp("/passports/project-1");
    expect(await screen.findByText("You do not have permission to view this information.")).toBeInTheDocument();
    expect(screen.queryByText("You need to sign in to view this information.")).not.toBeInTheDocument();
  });

  it("handles a 404 as a missing Passport record", async () => {
    vi.mocked(getOfficialProjectPassport).mockRejectedValue(new ApiError(404, "not found"));
    renderApp("/passports/missing-project");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("preserves retry behavior for other backend errors", async () => {
    vi.mocked(getOfficialProjectPassport).mockRejectedValue(new ApiError(500, "internal error"));
    renderApp("/passports/project-1");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});