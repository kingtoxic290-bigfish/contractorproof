import { screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listContractors } from "../features/contractors/api/contractorsApi";
import { getOfficialPassports, loadContractorHistory } from "../features/passports/api/passportsApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import {
  contractorRecord,
  evidenceRecord,
  milestoneRecord,
  projectRecord,
} from "./fixtures";
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
}));

vi.mock("../features/passports/api/passportsApi", () => ({
  getOfficialPassports: vi.fn(),
  loadContractorHistory: vi.fn(),
}));

const contractor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
});
const project = projectRecord({
  id: "p1",
  name: "Bridge deck",
  contractorId: "c1",
  procuringEntity: "Demo Procuring Entity",
  contractStatus: "ACTIVE",
});
const milestone = milestoneRecord({
  id: "m1",
  name: "Foundation",
  status: "PENDING",
  projectId: "p1",
});

function history(verificationStatus: string, extra?: { status?: string; fileName?: string }) {
  return {
    contractor,
    projects: [
      {
        project,
        milestones: [milestone],
        evidence: [
          evidenceRecord({
            id: "e1",
            fileName: extra?.fileName ?? "site.jpg",
            milestoneId: "m1",
            status: extra?.status ?? "PENDING_VERIFICATION",
            verificationStatus,
          }),
        ],
      },
    ],
  };
}

function mockAuditor() {
  seedSession();
  vi.mocked(authApi.me).mockResolvedValue({
    id: "user-2",
    email: "auditor@example.com",
    fullName: "Demo Auditor",
    role: "AUDITOR",
  });
}

describe("passports", () => {
  beforeEach(() => {
    mockAuditor();
    vi.mocked(getOfficialPassports).mockRejectedValue(
      new ApiError(501, "Not implemented in scaffold phase", "passports"),
    );
    vi.mocked(listContractors).mockResolvedValue([contractor]);
    vi.mocked(loadContractorHistory).mockReset();
  });

  it("shows a loading state for the official projection", async () => {
    vi.mocked(getOfficialPassports).mockReturnValue(new Promise(() => undefined));
    renderApp("/passports");
    expect(await screen.findByText("Checking the passport projection...")).toBeInTheDocument();
  });

  it("shows the official passport API as unavailable and lists contractors", async () => {
    renderApp("/passports");
    expect(await screen.findByText("This information is not available from the API yet.")).toBeInTheDocument();
    expect(screen.getByText("The server reported that this resource is not implemented. No records are shown.")).toBeInTheDocument();
    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Contractor Score: 92")).not.toBeInTheDocument();
    expect(screen.queryByText("Trust Score: 87%")).not.toBeInTheDocument();
    expect(screen.queryByText("4.8/5")).not.toBeInTheDocument();
  });

  it("shows an empty contractor index", async () => {
    vi.mocked(listContractors).mockResolvedValue([]);
    renderApp("/passports");
    expect(await screen.findByText("No contractors available.")).toBeInTheDocument();
  });

  it("loads contractor project history", async () => {
    vi.mocked(loadContractorHistory).mockReturnValue(new Promise(() => undefined));
    renderApp("/passports/c1");
    expect(await screen.findByText("Loading project history...")).toBeInTheDocument();
  });

  it("renders project, milestone, and evidence history without inventing scores", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue(history("PENDING"));
    renderApp("/passports/c1");

    expect((await screen.findAllByText("Harbor Works Ltd")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Bridge deck").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Foundation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("site.jpg").length).toBeGreaterThan(0);
    expect(screen.getByText("Demo Procuring Entity")).toBeInTheDocument();
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING_VERIFICATION").length).toBeGreaterThan(0);
    expect(screen.getByText("Verification is pending.")).toBeInTheDocument();
    expect(screen.getByText("Contractor record created")).toBeInTheDocument();
    expect(screen.getByText("Project registered")).toBeInTheDocument();
    expect(screen.getByText("Milestone recorded")).toBeInTheDocument();
    expect(screen.getByText("Evidence uploaded")).toBeInTheDocument();
    expect(screen.queryByText(/Site Handover|Blockchain Anchor|Contract Award/)).not.toBeInTheDocument();
    expect(screen.queryByText("Contractor Score: 92")).not.toBeInTheDocument();
    expect(screen.queryByText("99% verified")).not.toBeInTheDocument();
    expect(screen.queryByText("star rating")).not.toBeInTheDocument();
  });

  it("keeps MATCH as MATCH", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue(history("MATCH"));
    renderApp("/passports/c1");
    expect((await screen.findAllByText("MATCH")).length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence fingerprint matches the recorded integrity value.")).toBeInTheDocument();
    expect(screen.queryByText("Document is genuine.")).not.toBeInTheDocument();
  });

  it("keeps MISMATCH as MISMATCH", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue(history("MISMATCH"));
    renderApp("/passports/c1");
    expect((await screen.findAllByText("MISMATCH")).length).toBeGreaterThan(0);
    expect(
      screen.getByText("Evidence fingerprint does not match the recorded integrity value."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/fraud|trustworthy|honest/i)).not.toBeInTheDocument();
    expect(screen.queryByText("MATCH")).not.toBeInTheDocument();
  });

  it("keeps UNAVAILABLE as UNAVAILABLE", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue(history("UNAVAILABLE"));
    renderApp("/passports/c1");
    expect((await screen.findAllByText("UNAVAILABLE")).length).toBeGreaterThan(0);
    expect(screen.getByText("Verification result is currently unavailable.")).toBeInTheDocument();
  });

  it("does not invent attestation decisions or blockchain anchors", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue(history("PENDING"));
    renderApp("/passports/c1");
    expect(await screen.findByText("Attestations")).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/v1\/attestations is not implemented/)).toBeInTheDocument();
    expect(screen.getByText("Blockchain proof")).toBeInTheDocument();
    expect(screen.getByText(/GET \/api\/v1\/blockchain is not implemented/)).toBeInTheDocument();
    expect(screen.queryByText("APPROVED")).not.toBeInTheDocument();
    expect(screen.queryByText("REJECTED")).not.toBeInTheDocument();
    expect(screen.queryByText("Status: Anchored")).not.toBeInTheDocument();
    expect(screen.queryByText(/0x[a-f0-9]{16}/i)).not.toBeInTheDocument();
  });

  it("shows an empty project history", async () => {
    vi.mocked(loadContractorHistory).mockResolvedValue({ contractor, projects: [] });
    renderApp("/passports/c1");
    expect(
      await screen.findByText("GET /api/v1/projects returned no projects with this contractorId."),
    ).toBeInTheDocument();
  });

  it("handles unauthorized access", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(401, "missing bearer token"));
    renderApp("/passports/c1");
    expect(await screen.findByText("You need to sign in to view this information.")).toBeInTheDocument();
  });

  it("handles forbidden access", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(403, "insufficient permission"));
    renderApp("/passports/c1");
    expect(
      await screen.findByText("You do not have permission to view this information."),
    ).toBeInTheDocument();
  });

  it("handles a missing contractor", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(404, "contractor not found"));
    renderApp("/passports/c1");
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });

  it("handles a server error", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(500, "internal server error"));
    renderApp("/passports/c1");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("handles a temporary outage", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(503, "service unavailable"));
    renderApp("/passports/c1");
    expect(await screen.findByText("The service is temporarily unavailable.")).toBeInTheDocument();
  });

  it("handles a network failure", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new TypeError("Failed to fetch"));
    renderApp("/passports/c1");
    expect(await screen.findByText("We couldn't reach the server. Please try again.")).toBeInTheDocument();
  });

  it("handles a conflict", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(409, "conflict"));
    renderApp("/passports/c1");
    expect(await screen.findByText("This request conflicts with an existing record.")).toBeInTheDocument();
  });

  it("handles an unprocessable request", async () => {
    vi.mocked(loadContractorHistory).mockRejectedValue(new ApiError(422, "unprocessable"));
    renderApp("/passports/c1");
    expect(await screen.findByText("The server could not accept this information.")).toBeInTheDocument();
  });
});
