import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listCorrections } from "../features/corrections/api/correctionsApi";
import { listDisputes } from "../features/disputes/api/disputesApi";
import { listEvidence } from "../features/evidence/api/evidenceApi";
import {
  getMilestone,
  listMilestoneHistory,
  listProjectMilestones,
  transitionMilestone,
} from "../features/milestones/api/milestonesApi";
import { getProject } from "../features/projects/api/projectsApi";
import { authApi } from "../services/api/auth";
import { createAttestation, listAttestations } from "../features/verification/api/attestationApi";
import { evidenceRecord, milestoneRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: { me: vi.fn(), login: vi.fn(), register: vi.fn() },
}));

vi.mock("../features/projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
  getProject: vi.fn(),
  createProject: vi.fn(),
  assignProjectContractor: vi.fn(),
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  getMilestone: vi.fn(),
  listProjectMilestones: vi.fn(),
  createMilestone: vi.fn(),
  listMilestoneHistory: vi.fn(),
  transitionMilestone: vi.fn(),
}));

vi.mock("../features/verification/api/attestationApi", () => ({
  createAttestation: vi.fn(),
  listAttestations: vi.fn(),
}));

vi.mock("../features/corrections/api/correctionsApi", () => ({
  listCorrections: vi.fn(),
}));

vi.mock("../features/disputes/api/disputesApi", () => ({
  listDisputes: vi.fn(),
}));

vi.mock("../features/evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
}));

// The milestone detail screen reads recorded evidence versions from the stored
// verification history. It is mocked here so the page never reaches the network.
vi.mock("../features/verification/api/verificationHistoryApi", () => ({
  listVerificationHistory: vi.fn(() => Promise.resolve([])),
}));

vi.mock("../features/contractors/api/contractorsApi", () => ({
  listContractors: vi.fn(() => Promise.resolve([])),
  getContractor: vi.fn(),
}));

const MILESTONE_ID = "55555555-5555-4555-8555-555555555555";
const PROJECT_ID = "66666666-6666-4666-8666-666666666666";
// The attestation client validates both identifiers as UUIDs before sending.
const EVIDENCE_ID = "77777777-7777-4777-8777-777777777777";

const milestone = milestoneRecord({
  id: MILESTONE_ID,
  projectId: PROJECT_ID,
  name: "Deck pour",
  status: "IN_PROGRESS",
});

const evidence = evidenceRecord({
  id: EVIDENCE_ID,
  milestoneId: MILESTONE_ID,
  fileName: "deck-pour.jpg",
  status: "PENDING_VERIFICATION",
});

const history = [
  {
    id: "history-1",
    milestoneId: MILESTONE_ID,
    previousStatus: null,
    newStatus: "PENDING",
    actorName: "Demo Client",
    actorRole: "CLIENT",
    evidenceId: null,
    isBaseline: true,
    reason: null,
    createdAt: "2026-09-01T09:00:00.000Z",
  },
  {
    id: "history-2",
    milestoneId: MILESTONE_ID,
    previousStatus: "PENDING",
    newStatus: "IN_PROGRESS",
    actorName: "Demo Contractor",
    actorRole: "CONTRACTOR",
    evidenceId: null,
    isBaseline: false,
    reason: "Site access granted",
    createdAt: "2026-09-05T09:00:00.000Z",
  },
];

function signIn(role: "CLIENT" | "CONTRACTOR" | "ADMIN") {
  vi.mocked(authApi.me).mockResolvedValue({
    id: role === "CONTRACTOR" ? "contractor-user" : "client-user",
    email: `${role.toLowerCase()}@example.com`,
    fullName: role === "CONTRACTOR" ? "Demo Contractor" : "Demo Client",
    role,
  });
}

function seedWorkflow({ corrections = 1, disputes = 1, approved = 1 } = {}) {
  vi.mocked(listAttestations).mockResolvedValue(
    Array.from({ length: approved }, (_unused, index) => ({
      id: `attestation-${index}`,
      evidenceId: EVIDENCE_ID,
      milestoneId: MILESTONE_ID,
      decision: "APPROVED",
      verifierRole: "CLIENT",
      comment: null,
      createdAt: "2026-09-06T09:00:00.000Z",
    })),
  );
  vi.mocked(listCorrections).mockResolvedValue(
    Array.from({ length: corrections }, (_unused, index) => ({
      id: `correction-${index}`,
      milestoneId: MILESTONE_ID,
      originalEventId: "event-1",
      originalProof: null,
      originalEvidenceVersion: null,
      evidenceId: EVIDENCE_ID,
      correctedEvidence: null,
      actorId: "client-user",
      reason: "Photo does not show the pour completion",
      status: "OPEN" as const,
      blockchainProof: null,
      resolutions: [],
      createdAt: "2026-09-07T09:00:00.000Z",
    })),
  );
  vi.mocked(listDisputes).mockResolvedValue(
    Array.from({ length: disputes }, (_unused, index) => ({
      id: `dispute-${index}`,
      milestoneId: MILESTONE_ID,
      evidenceId: EVIDENCE_ID,
      raisedById: "client-user",
      status: "OPEN" as const,
      reason: "Delay cause disputed",
      originalEventId: "event-1",
      createdAt: "2026-09-08T09:00:00.000Z",
      updatedAt: "2026-09-08T09:00:00.000Z",
      blockchainProof: null,
      originalProof: null,
      resolutionProof: null,
      resolutions: [],
    })),
  );
}

describe("Phase 4.4 project execution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    vi.mocked(getMilestone).mockResolvedValue(milestone);
    vi.mocked(listMilestoneHistory).mockResolvedValue(history);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);
    vi.mocked(listEvidence).mockResolvedValue([evidence]);
    seedWorkflow();
  });

  // TASK 3 / 16: factual execution state, no invented progress figure.
  it("shows a client the factual execution state of a milestone", async () => {
    signIn("CLIENT");
    renderApp(`/milestones/${MILESTONE_ID}`);

    expect(await screen.findByText("Client approvals")).toBeInTheDocument();
    expect(screen.getByText("Milestone status")).toBeInTheDocument();
    // The stored status is shown on the milestone record and restated by the
    // execution summary, so more than one badge can carry the same label.
    expect(screen.getAllByText("In progress").length).toBeGreaterThan(0);
    expect(screen.getByText("Evidence records")).toBeInTheDocument();
    expect(screen.getByText("Corrections requested")).toBeInTheDocument();
    expect(screen.getByText("Disputes raised")).toBeInTheDocument();
    // Statuses and counts only: no percentage and no verdict language.
    expect(screen.queryAllByText(/%/)).toHaveLength(0);
    expect(screen.queryAllByText(/trustworthy|reputation|excellent|poor contractor/i)).toHaveLength(0);
  });

  it("shows the appended status history including the recorded reason", async () => {
    signIn("CLIENT");
    renderApp(`/milestones/${MILESTONE_ID}`);

    expect(await screen.findByText("Created as Pending")).toBeInTheDocument();
    expect(screen.getByText("Pending → In progress")).toBeInTheDocument();
    expect(screen.getByText("Site access granted")).toBeInTheDocument();
  });

  // TASK 5: client review outcomes, each a distinct record.
  it("records a client approval as an attestation followed by a verified transition", async () => {
    const user = userEvent.setup();
    signIn("CLIENT");
    vi.mocked(createAttestation).mockResolvedValue({
      id: "attestation-new",
      evidenceId: EVIDENCE_ID,
      milestoneId: MILESTONE_ID,
      decision: "APPROVED",
      verifierRole: "CLIENT",
      comment: null,
      createdAt: "2026-09-09T09:00:00.000Z",
    });
    vi.mocked(transitionMilestone).mockResolvedValue({
      milestone: { ...milestone, status: "VERIFIED" },
      historyEntry: history[0],
    });

    renderApp(`/milestones/${MILESTONE_ID}/review`);

    await user.click(await screen.findByRole("button", { name: "Approve submission" }));

    expect(createAttestation).toHaveBeenCalledWith({
      evidenceId: EVIDENCE_ID,
      milestoneId: MILESTONE_ID,
      decision: "APPROVED",
    });
    expect(transitionMilestone).toHaveBeenCalledWith(MILESTONE_ID, {
      status: "VERIFIED",
      evidenceId: EVIDENCE_ID,
    });
    expect(await screen.findByText("Milestone recorded as VERIFIED.")).toBeInTheDocument();
  });

  it("offers correction and dispute as separate workflows on the review page", async () => {
    signIn("CLIENT");
    renderApp(`/milestones/${MILESTONE_ID}/review`);

    expect(await screen.findByRole("link", { name: "Request correction" })).toHaveAttribute(
      "href",
      `/corrections?milestoneId=${MILESTONE_ID}`,
    );
    expect(screen.getByRole("link", { name: "Raise dispute" })).toHaveAttribute(
      "href",
      `/disputes?milestoneId=${MILESTONE_ID}`,
    );
    // Approval language describes the review decision, not the contractor.
    expect(screen.getByText(/not a judgement about the contractor/i)).toBeInTheDocument();
  });

  // TASK 4: contractor progress, and no approval controls anywhere.
  it("lets a contractor record progress but never approve", async () => {
    const user = userEvent.setup();
    signIn("CONTRACTOR");
    vi.mocked(transitionMilestone).mockResolvedValue({
      milestone: { ...milestone, status: "PENDING_VERIFICATION" },
      historyEntry: history[1],
    });

    renderApp(`/milestones/${MILESTONE_ID}`);

    await user.click(await screen.findByRole("button", { name: "Submit for verification" }));

    expect(transitionMilestone).toHaveBeenCalledWith(MILESTONE_ID, {
      status: "PENDING_VERIFICATION",
      evidenceId: EVIDENCE_ID,
    });
    expect(screen.queryByRole("button", { name: "Approve submission" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reject submission" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review submission" })).not.toBeInTheDocument();
  });

  it("refuses to let a contractor submit for verification without evidence", async () => {
    signIn("CONTRACTOR");
    vi.mocked(listEvidence).mockResolvedValue([]);

    renderApp(`/milestones/${MILESTONE_ID}`);

    expect(
      await screen.findByText(/Upload evidence for this milestone before submitting/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit for verification" })).toBeDisabled();
    expect(transitionMilestone).not.toHaveBeenCalled();
  });

  // TASK 15: direct navigation, not only hidden controls.
  it("denies a contractor who navigates straight to the review page", async () => {
    signIn("CONTRACTOR");
    renderApp(`/milestones/${MILESTONE_ID}/review`);

    expect(await screen.findByRole("heading", { name: "Access denied" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Approve submission" })).not.toBeInTheDocument();
    expect(createAttestation).not.toHaveBeenCalled();
    expect(transitionMilestone).not.toHaveBeenCalled();
  });

  it("shows the execution summary for each milestone on the project page", async () => {
    signIn("CLIENT");
    vi.mocked(getProject).mockResolvedValue({
      id: PROJECT_ID,
      clientName: "Demo Client",
      contractorId: "contractor-1",
      contractorName: "Demo Contractor Ltd",
      contractorCrbRegistrationNumber: "CRB-204",
      name: "Harbor bridge deck",
      description: null,
      nestTenderReference: null,
      nestContractReference: null,
      ocid: null,
      procuringEntity: null,
      contractStatus: "ACTIVE",
      contractStartDate: null,
      contractEndDate: null,
      nestSource: "SYNTHETIC_DEMO",
      createdAt: "2026-09-01T09:00:00.000Z",
      updatedAt: "2026-09-01T09:00:00.000Z",
    });

    renderApp(`/projects/${PROJECT_ID}`);

    expect(await screen.findByText("Recorded review events")).toBeInTheDocument();
    expect(screen.getByText("Milestone status")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open milestone" })).toHaveAttribute(
      "href",
      `/milestones/${MILESTONE_ID}`,
    );
  });
});

describe("milestone history is not confused with an empty history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    seedSession();
    signIn("CLIENT");
    vi.mocked(listEvidence).mockResolvedValue([]);
    vi.mocked(listAttestations).mockResolvedValue([]);
    vi.mocked(listCorrections).mockResolvedValue([]);
    vi.mocked(listDisputes).mockResolvedValue([]);
    vi.mocked(getMilestone).mockResolvedValue(milestone);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);
  });

  it("says the history could not be loaded rather than that none was recorded", async () => {
    // A refused or failed history request is not evidence that nothing was
    // ever recorded, and must not be rendered as though it were.
    vi.mocked(listMilestoneHistory).mockRejectedValue(new Error("forbidden"));

    renderApp(`/milestones/${MILESTONE_ID}`);

    expect(await screen.findByText(/could not be loaded/i)).toBeInTheDocument();
    expect(screen.queryByText(/No recorded status history/i)).not.toBeInTheDocument();
  });

  it("still says no history when the request genuinely returns nothing", async () => {
    vi.mocked(listMilestoneHistory).mockResolvedValue([]);

    renderApp(`/milestones/${MILESTONE_ID}`);

    expect(await screen.findByText(/No recorded status history/i)).toBeInTheDocument();
  });

  it("offers the review screen to the client from the milestone list", async () => {
    vi.mocked(listMilestoneHistory).mockResolvedValue(history);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);

    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), PROJECT_ID);
    await user.click(screen.getByRole("button", { name: "Load milestones" }));

    const review = await screen.findByRole("link", { name: "Review submission" });
    expect(review).toHaveAttribute("href", `/milestones/${MILESTONE_ID}/review`);
  });

  it("does not offer the review screen to the assigned contractor", async () => {
    signIn("CONTRACTOR");
    vi.mocked(listMilestoneHistory).mockResolvedValue(history);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);

    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), PROJECT_ID);
    await user.click(screen.getByRole("button", { name: "Load milestones" }));

    expect(await screen.findByRole("heading", { name: "Deck pour" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Review submission" })).not.toBeInTheDocument();
  });
});
