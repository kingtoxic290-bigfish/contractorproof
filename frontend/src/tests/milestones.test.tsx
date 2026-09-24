import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { listProjectMilestones } from "../features/milestones/api/milestonesApi";
import { authApi } from "../services/api/auth";
import { ApiError } from "../services/api/errors";
import { milestoneRecord } from "./fixtures";
import { renderApp, seedSession } from "./renderApp";

vi.mock("../services/api/auth", () => ({
  authApi: {
    me: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
  },
}));

vi.mock("../features/milestones/api/milestonesApi", () => ({
  listProjectMilestones: vi.fn(),
}));

describe("milestones", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(authApi.me).mockResolvedValue({
      id: "user-2",
      email: "auditor@example.com",
      fullName: "Demo Auditor",
      role: "AUDITOR",
    });
  });

  it("does not fetch until a project identifier is provided", async () => {
    renderApp("/milestones");
    expect(await screen.findByRole("heading", { name: "Milestones" })).toBeInTheDocument();
    expect(listProjectMilestones).not.toHaveBeenCalled();
  });

  it("renders returned milestone status exactly", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "m1", name: "Foundation", status: "FAILED", projectId: "p1" }),
    ]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("Foundation")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getByText("Project p1")).toBeInTheDocument();
    expect(screen.queryByText("VERIFIED")).not.toBeInTheDocument();
    expect(screen.queryByText("Verified")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete")).not.toBeInTheDocument();
  });

  it("renders multiple milestone records", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([
      milestoneRecord({ id: "m1", name: "Foundation", status: "FAILED", projectId: "p1" }),
      milestoneRecord({ id: "m2", name: "Structure", status: "PENDING", projectId: "p1" }),
    ]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("Foundation")).toBeInTheDocument();
    expect(screen.getByText("Structure")).toBeInTheDocument();
    expect(screen.getAllByText("FAILED").length).toBeGreaterThan(0);
    expect(screen.getAllByText("PENDING").length).toBeGreaterThan(0);
  });

  it("shows an empty state", async () => {
    vi.mocked(listProjectMilestones).mockResolvedValue([]);
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("No milestones available.")).toBeInTheDocument();
  });

  it("shows an API error", async () => {
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(500, "internal server error"));
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "p1");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("shows a not-found state when the project is missing", async () => {
    vi.mocked(listProjectMilestones).mockRejectedValue(new ApiError(404, "project not found"));
    const user = userEvent.setup();
    renderApp("/milestones");
    await user.type(await screen.findByLabelText("Project identifier"), "missing");
    await user.click(screen.getByRole("button", { name: "Load milestones" }));
    expect(await screen.findByText("The requested record was not found.")).toBeInTheDocument();
  });
});
