import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { projectRecord } from "../../../tests/fixtures";
import { getProject, listProjects } from "./projectsApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const bridge = projectRecord({
  id: "p1",
  name: "Bridge deck",
  contractStatus: "ACTIVE",
});

const road = projectRecord({
  id: "p2",
  name: "Coastal road",
  contractStatus: "DRAFT",
});

describe("projectsApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a projects collection envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ projects: [bridge] });

    await expect(listProjects()).resolves.toEqual([bridge]);
    expect(apiRequest).toHaveBeenCalledWith("/projects");
  });

  it("unwraps multiple project records", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ projects: [bridge, road] });

    await expect(listProjects()).resolves.toEqual([bridge, road]);
  });

  it("unwraps an empty projects collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ projects: [] });

    await expect(listProjects()).resolves.toEqual([]);
  });

  it("unwraps a project detail envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ project: bridge });

    await expect(getProject("p1")).resolves.toEqual(bridge);
    expect(apiRequest).toHaveBeenCalledWith("/projects/p1");
  });

  it("rejects a raw project array", async () => {
    vi.mocked(apiRequest).mockResolvedValue([bridge]);

    await expect(listProjects()).rejects.toThrow("The project list response is not in a known format.");
  });

  it("keeps null project fields as null", async () => {
    const sparse = projectRecord({ id: "p3", name: "Sparse project" });
    vi.mocked(apiRequest).mockResolvedValue({ project: sparse });

    const project = await getProject("p3");
    expect(project.description).toBeNull();
    expect(project.nestTenderReference).toBeNull();
    expect(project.contractStatus).toBeNull();
    expect(project.contractStartDate).toBeNull();
  });
});
