import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../services/api/client";
import { renderApp, seedSession } from "./renderApp";

/**
 * Regression coverage for the CLIENT Create Project contractor selector.
 *
 * These tests mock only the HTTP boundary (`apiRequest`). The real
 * `listContractors` parser, `useContractors` hook and Create Project page are
 * all exercised, so the payload below is the actual `GET /api/v1/contractors`
 * response shape rather than a pre-parsed fixture.
 */
vi.mock("../services/api/client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/api/client")>();
  return { ...actual, apiRequest: vi.fn() };
});

vi.mock("../features/projects/api/projectsApi", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../features/projects/api/projectsApi")
  >();
  return { ...actual, createProject: vi.fn() };
});

/** Mirrors `PublicContractor` as the backend currently serialises it. */
function contractorPayload(overrides: {
  id: string;
  legalName: string;
  crbSource: string | null;
}) {
  return {
    id: overrides.id,
    userId: `user-${overrides.id}`,
    legalName: overrides.legalName,
    crbRegistrationNumber: null,
    crbCategory: null,
    crbType: null,
    crbClass: null,
    crbStatus: null,
    crbLastVerifiedAt: null,
    crbSource: overrides.crbSource,
    createdAt: "2026-09-24T07:49:43.000Z",
    updatedAt: "2026-09-24T07:49:43.000Z",
    user: {
      id: `user-${overrides.id}`,
      email: `${overrides.id}@example.com`,
      fullName: overrides.legalName,
      role: "CONTRACTOR",
    },
  };
}

const checked = contractorPayload({
  id: "contractor-1",
  legalName: "Harbor Works Ltd",
  crbSource: "SANDBOX",
});
/** The API returns null until a CRB check has actually run. */
const neverChecked = contractorPayload({
  id: "contractor-2",
  legalName: "Unverified Quarry Ltd",
  crbSource: null,
});

describe("create project contractor selector", () => {
  beforeEach(() => {
    seedSession();
    vi.mocked(apiRequest).mockReset();
  });

  function routeRequests(contractors: unknown[]) {
    vi.mocked(apiRequest).mockImplementation(async (path: string) => {
      if (path === "/auth/me") {
        return {
          user: {
            id: "user-3",
            email: "client@example.com",
            fullName: "Demo Client",
            role: "CLIENT",
          },
        } as never;
      }
      if (path === "/contractors") {
        return { contractors } as never;
      }
      return {} as never;
    });
  }

  it("populates the selector from the real contractors payload", async () => {
    routeRequests([checked, neverChecked]);
    renderApp("/projects/new");

    // The label renders immediately, so wait for the parsed records to arrive.
    await screen.findByRole("option", { name: "Harbor Works Ltd" });
    await screen.findByRole("option", { name: "Unverified Quarry Ltd" });

    const selector = screen.getByLabelText("Assign contractor");
    const options = screen.getAllByRole("option").map((option) => option.textContent);

    expect(options).toContain("Harbor Works Ltd");
    expect(options).toContain("Unverified Quarry Ltd");
    expect(
      screen.queryByText("We couldn't load this information. Please try again."),
    ).not.toBeInTheDocument();
    expect(selector).not.toBeDisabled();
  });

  it("does not fail when one contractor has never been CRB checked", async () => {
    routeRequests([neverChecked]);
    renderApp("/projects/new");

    await screen.findByRole("option", { name: "Unverified Quarry Ltd" });

    const selector = screen.getByLabelText("Assign contractor");
    expect(screen.getAllByRole("option").length).toBeGreaterThan(1);
    expect(selector).not.toBeDisabled();
  });

  it("still creates the project with the selected contractor", async () => {
    const user = userEvent.setup();
    routeRequests([checked, neverChecked]);
    const { createProject } = await import("../features/projects/api/projectsApi");
    vi.mocked(createProject).mockResolvedValue({
      id: "33333333-3333-4333-8333-333333333333",
      name: "New bridge",
      contractStatus: "ACTIVE",
    } as never);

    renderApp("/projects/new");
    await screen.findByRole("option", { name: "Unverified Quarry Ltd" });
    await user.type(screen.getByLabelText("Project name"), "New bridge");
    await user.selectOptions(screen.getByLabelText("Assign contractor"), "contractor-2");
    await user.click(screen.getByRole("button", { name: "Create Project and Assign Contractor" }));

    expect(await screen.findByText("Project created and assigned to Unverified Quarry Ltd.")).toBeInTheDocument();
    expect(vi.mocked(createProject)).toHaveBeenCalledWith({
      name: "New bridge",
      contractorId: "contractor-2",
    });
  });
});