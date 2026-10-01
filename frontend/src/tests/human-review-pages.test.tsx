import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../services/api/client";
import { authApi } from "../services/api/auth";
import { renderApp, seedSession } from "./renderApp";

/**
 * Integration coverage for the human review workflow pages.
 *
 * Only the HTTP boundary is mocked, so the real parsers, role gates and pages
 * run against the backend's actual `{ data, meta }` envelope.
 */
vi.mock("../services/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api/client")>();
  return { ...actual, apiRequest: vi.fn() };
});

vi.mock("../services/api/auth", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

const projectId = "11111111-1111-4111-8111-111111111111";
const milestoneId = "22222222-2222-4222-8222-222222222222";

const correctionRecord = {
  id: "correction-1",
  milestoneId,
  originalEventId: "event-1",
  originalProof: {
    id: "event-1",
    eventType: "VERIFICATION",
    referenceId: null,
    txHash: "0xabc123",
    blockNumber: 7,
    confirmationState: "CONFIRMED",
    confirmed: true,
  },
  originalEvidenceVersion: null,
  evidenceId: "evidence-1",
  correctedEvidence: null,
  actorId: "user-client",
  reason: "Photo does not show the completed pour.",
  status: "OPEN",
  blockchainProof: null,
  resolutions: [],
  createdAt: "2026-10-01T10:00:00.000Z",
};

const disputeRecord = {
  id: "dispute-1",
  milestoneId,
  evidenceId: "evidence-1",
  raisedById: "user-client",
  status: "OPEN",
  reason: "The result does not match the site condition.",
  originalEventId: "event-1",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  blockchainProof: null,
  originalProof: {
    id: "event-1",
    eventType: "VERIFICATION",
    referenceId: null,
    txHash: "0xabc123",
    blockNumber: 7,
    confirmationState: "CONFIRMED",
    confirmed: true,
  },
  resolutionProof: null,
  resolutions: [],
};

function route(role: string, payload: Record<string, unknown>) {
  vi.mocked(authApi.me).mockResolvedValue({
    id: `user-${role}`,
    email: `${role.toLowerCase()}@example.com`,
    fullName: `Demo ${role}`,
    role,
  } as never);

  vi.mocked(apiRequest).mockImplementation(async (path: string) => {
    if (path === "/auth/me") {
      return { user: { id: `user-${role}`, email: `${role.toLowerCase()}@example.com`, fullName: `Demo ${role}`, role } } as never;
    }
    if (path.startsWith("/corrections")) return { data: payload, meta: {} } as never;
    if (path.startsWith("/disputes")) return { data: payload, meta: {} } as never;
    return {} as never;
  });
}

describe("human review workflow pages", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(apiRequest).mockReset();
  });

  it("shows a client their corrections with status, reason and timestamps", async () => {
    route("CLIENT", { corrections: [correctionRecord] });
    renderApp(`/corrections?projectId=${projectId}&milestoneId=${milestoneId}`);

    expect(await screen.findByText("Photo does not show the completed pour.")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.getByText("Raised 2026-10-01T10:00:00.000Z")).toBeInTheDocument();
    // The original blockchain proof is shown as context, not edited.
    expect(screen.getByText(/VERIFICATION · CONFIRMED · block 7/)).toBeInTheDocument();
  });

  it("does not offer correction review actions to a client", async () => {
    route("CLIENT", { corrections: [correctionRecord] });
    renderApp(`/corrections?projectId=${projectId}`);

    await screen.findByText("Photo does not show the completed pour.");

    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject" })).not.toBeInTheDocument();
  });

  it("offers review actions to an auditor", async () => {
    route("AUDITOR", { corrections: [correctionRecord] });
    renderApp(`/corrections?projectId=${projectId}`);

    await screen.findByText("Photo does not show the completed pour.");

    expect(screen.getByRole("button", { name: "Start review" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("lets a contractor see corrections on their own work", async () => {
    route("CONTRACTOR", { corrections: [correctionRecord] });
    renderApp(`/corrections?projectId=${projectId}`);

    expect(await screen.findByText("Photo does not show the completed pour.")).toBeInTheDocument();
    // A contractor may request but not resolve.
    expect(screen.getByRole("button", { name: "Request correction" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve" })).not.toBeInTheDocument();
  });

  it("shows disputes with factual status and resolution context", async () => {
    route("CLIENT", { disputes: [disputeRecord] });
    renderApp(`/disputes?projectId=${projectId}&milestoneId=${milestoneId}`);

    expect(await screen.findByText("The result does not match the site condition.")).toBeInTheDocument();
    expect(screen.getByText("OPEN")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resolve" })).not.toBeInTheDocument();
  });

  it("offers dispute resolution to a procurement officer", async () => {
    route("PROCUREMENT_OFFICER", { disputes: [disputeRecord] });
    renderApp(`/disputes?projectId=${projectId}`);

    await screen.findByText("The result does not match the site condition.");

    expect(screen.getByRole("button", { name: "Resolve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("never renders a technical MATCH/MISMATCH control on the dispute page", async () => {
    route("ADMIN", { disputes: [disputeRecord] });
    renderApp(`/disputes?projectId=${projectId}`);

    await screen.findByText("The result does not match the site condition.");

    expect(screen.queryByRole("button", { name: /match/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/MISMATCH/)).not.toBeInTheDocument();
  });

  it("requests a correction through the form", async () => {
    const user = userEvent.setup();
    route("CLIENT", { corrections: [] });
    vi.mocked(apiRequest).mockImplementation(async (path: string, init?: { body?: unknown }) => {
      if (path === "/auth/me") {
        return { user: { id: "user-CLIENT", email: "client@example.com", fullName: "Demo CLIENT", role: "CLIENT" } } as never;
      }
      if (path === "/corrections" && init?.method === "POST") {
        return { data: { correction: correctionRecord }, meta: {} } as never;
      }
      if (path.startsWith("/corrections")) return { data: { corrections: [] }, meta: {} } as never;
      return {} as never;
    });

    renderApp("/corrections");
    await screen.findByRole("button", { name: "Request correction" });

    await user.type(screen.getByLabelText("Milestone identifier"), milestoneId);
    await user.type(
      screen.getByLabelText("Blockchain event to correct"),
      "33333333-3333-4333-8333-333333333333",
    );
    await user.type(screen.getByLabelText("Reason"), "Photo does not show the completed pour.");
    await user.click(screen.getByRole("button", { name: "Request correction" }));

    expect(await screen.findByText(/Correction requested\. Status: OPEN/)).toBeInTheDocument();
  });
});