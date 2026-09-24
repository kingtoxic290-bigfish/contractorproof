import { beforeEach, describe, expect, it, vi } from "vitest";
import { getContractor } from "../../contractors/api/contractorsApi";
import { listEvidence } from "../../evidence/api/evidenceApi";
import { listProjectMilestones } from "../../milestones/api/milestonesApi";
import { listProjects } from "../../projects/api/projectsApi";
import { apiRequest } from "../../../services/api/client";
import { ApiError } from "../../../services/api/errors";
import {
  contractorRecord,
  evidenceRecord,
  milestoneRecord,
  projectRecord,
} from "../../../tests/fixtures";
import { getOfficialPassports, getOfficialProjectPassport, loadContractorHistory } from "./passportsApi";
import { buildTimeline } from "../types";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

vi.mock("../../contractors/api/contractorsApi", () => ({
  getContractor: vi.fn(),
}));

vi.mock("../../projects/api/projectsApi", () => ({
  listProjects: vi.fn(),
}));

vi.mock("../../milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
}));

vi.mock("../../evidence/api/evidenceApi", () => ({
  listEvidence: vi.fn(),
}));

const contractor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
});
const owned = projectRecord({
  id: "p1",
  name: "Bridge deck",
  contractorId: "c1",
});
const other = projectRecord({
  id: "p2",
  name: "Other project",
  contractorId: "c-other",
});
const milestone = milestoneRecord({
  id: "m1",
  name: "Foundation",
  status: "PENDING",
  projectId: "p1",
});
const evidence = evidenceRecord({
  id: "e1",
  fileName: "site.jpg",
  milestoneId: "m1",
  status: "PENDING_VERIFICATION",
  verificationStatus: "PENDING",
});

describe("official passport endpoints", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("calls GET /passports and does not invent a success body", async () => {
    vi.mocked(apiRequest).mockRejectedValue(
      new ApiError(501, "Not implemented in scaffold phase", "passports"),
    );
    await expect(getOfficialPassports()).rejects.toMatchObject({ status: 501, resource: "passports" });
    expect(apiRequest).toHaveBeenCalledWith("/passports");
  });

  it("calls GET /passports/:projectId and rejects an unknown 200 envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ passport: { score: 99 } });
    await expect(getOfficialProjectPassport("p1")).rejects.toThrow(
      "The passport projection response is not in a known format.",
    );
    expect(apiRequest).toHaveBeenCalledWith("/passports/p1");
  });
});

describe("loadContractorHistory", () => {
  beforeEach(() => {
    vi.mocked(getContractor).mockReset();
    vi.mocked(listProjects).mockReset();
    vi.mocked(listProjectMilestones).mockReset();
    vi.mocked(listEvidence).mockReset();
  });

  it("composes contractor, owned projects, milestones, and evidence only", async () => {
    vi.mocked(getContractor).mockResolvedValue(contractor);
    vi.mocked(listProjects).mockResolvedValue([owned, other]);
    vi.mocked(listProjectMilestones).mockResolvedValue([milestone]);
    vi.mocked(listEvidence).mockResolvedValue([evidence]);

    const history = await loadContractorHistory("c1");

    expect(history.contractor).toEqual(contractor);
    expect(history.projects).toHaveLength(1);
    expect(history.projects[0]?.project.id).toBe("p1");
    expect(history.projects[0]?.milestones).toEqual([milestone]);
    expect(history.projects[0]?.evidence[0]?.verificationStatus).toBe("PENDING");
    expect(listProjectMilestones).toHaveBeenCalledWith("p1");
    expect(listEvidence).toHaveBeenCalledWith({ projectId: "p1" });
    expect(listProjectMilestones).not.toHaveBeenCalledWith("p2");
  });

  it("returns an empty project list when none belong to the contractor", async () => {
    vi.mocked(getContractor).mockResolvedValue(contractor);
    vi.mocked(listProjects).mockResolvedValue([other]);

    const history = await loadContractorHistory("c1");
    expect(history.projects).toEqual([]);
    expect(listProjectMilestones).not.toHaveBeenCalled();
    expect(listEvidence).not.toHaveBeenCalled();
  });

  it("builds a timeline only from returned timestamps", () => {
    const events = buildTimeline({
      contractor,
      projects: [{ project: owned, milestones: [milestone], evidence: [evidence] }],
    });
    expect(events.map((event) => event.label)).toEqual([
      "Contractor record created",
      "Project registered",
      "Milestone recorded",
      "Evidence uploaded",
    ]);
    expect(events.some((event) => /handover|blockchain|inspection|award/i.test(event.label))).toBe(
      false,
    );
  });
});
