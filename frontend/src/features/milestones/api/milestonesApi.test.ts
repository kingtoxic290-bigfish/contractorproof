import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { milestoneRecord } from "../../../tests/fixtures";
import {
  createMilestone,
  getMilestone,
  listMilestones,
  listProjectMilestones,
} from "./milestonesApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const foundation = milestoneRecord({
  id: "m1",
  name: "Foundation",
  status: "FAILED",
  projectId: "p1",
});

const structure = milestoneRecord({
  id: "m2",
  name: "Structure",
  status: "PENDING",
  projectId: "p1",
});

describe("milestonesApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a project milestones collection envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestones: [foundation] });

    await expect(listProjectMilestones("p1")).resolves.toEqual([foundation]);
    expect(apiRequest).toHaveBeenCalledWith("/projects/p1/milestones");
  });

  it("exposes the repository-neutral listMilestones alias", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestones: [foundation] });

    await expect(listMilestones("p1")).resolves.toEqual([foundation]);
    expect(apiRequest).toHaveBeenCalledWith("/projects/p1/milestones");
  });

  it("unwraps multiple milestone records", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestones: [foundation, structure] });

    await expect(listProjectMilestones("p1")).resolves.toEqual([foundation, structure]);
  });

  it("unwraps an empty milestones collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestones: [] });

    await expect(listProjectMilestones("p1")).resolves.toEqual([]);
  });

  it("preserves milestone status text exactly", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestones: [foundation] });

    const [milestone] = await listProjectMilestones("p1");
    expect(milestone.status).toBe("FAILED");
  });

  it("unwraps the existing milestone detail response", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ milestone: foundation });

    await expect(getMilestone("m1")).resolves.toEqual(foundation);
    expect(apiRequest).toHaveBeenCalledWith("/milestones/m1");
  });

  it("rejects a malformed milestone detail response", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { milestone: foundation } });

    await expect(getMilestone("m1")).rejects.toThrow(
      "The milestone response is not in a known format.",
    );
  });

  it("unwraps a milestone creation envelope", async () => {
    const created = milestoneRecord({
      id: "m3",
      name: "Inspection",
      status: "PENDING",
      projectId: "p1",
      description: "Site inspection",
    });
    vi.mocked(apiRequest).mockResolvedValue({ data: { milestone: created }, meta: {} });

    await expect(
      createMilestone("p1", {
        name: "Inspection",
        description: "Site inspection",
      }),
    ).resolves.toEqual(created);
    expect(apiRequest).toHaveBeenCalledWith("/projects/p1/milestones", {
      method: "POST",
      body: {
        name: "Inspection",
        description: "Site inspection",
      },
    });
  });

  it("rejects a raw milestone array", async () => {
    vi.mocked(apiRequest).mockResolvedValue([foundation]);

    await expect(listProjectMilestones("p1")).rejects.toThrow(
      "The milestone list response is not in a known format.",
    );
  });
});
