import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../services/api/client";
import { loadDashboard } from "./dashboardApi";

vi.mock("../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

describe("dashboard API", () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it("uses the authenticated shared client to GET the passport projection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { passports: [] } });

    await expect(loadDashboard()).resolves.toEqual([]);
    expect(apiRequest).toHaveBeenCalledExactlyOnceWith("/passports");
  });

  it("rejects an unknown response instead of treating it as an empty dashboard", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { passports: { count: 0 } } });

    await expect(loadDashboard()).rejects.toThrow("dashboard response is not in a known format");
  });
});