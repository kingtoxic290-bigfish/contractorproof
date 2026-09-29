import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { passportFixture } from "../../../tests/passportFixture";
import { getOfficialPassports, getOfficialProjectPassport } from "./passportsApi";

vi.mock("../../../services/api/client", () => ({ apiRequest: vi.fn() }));

describe("official passport endpoints", () => {
  beforeEach(() => vi.mocked(apiRequest).mockReset());

  it("reads and parses the backend-scoped project passport list", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { passports: [passportFixture] }, meta: {} });

    const passports = await getOfficialPassports();

    expect(apiRequest).toHaveBeenCalledWith("/passports");
    expect(passports).toHaveLength(1);
    expect(passports[0]?.project.id).toBe("project-1");
    expect(passports[0]?.milestones[0]?.evidence[0]?.versions).toHaveLength(2);
  });

  it("reads and parses one project Passport by the actual project ID route", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ data: { passport: passportFixture }, meta: {} });

    const passport = await getOfficialProjectPassport("project/id");

    expect(apiRequest).toHaveBeenCalledWith("/passports/project%2Fid");
    expect(passport.contractor.legalName).toBe("Harbor Works Ltd");
  });

  it("rejects malformed list and detail envelopes rather than showing partial records", async () => {
    vi.mocked(apiRequest).mockResolvedValueOnce({ data: { passports: [{ project: {} }] } });
    await expect(getOfficialPassports()).rejects.toThrow("The passport list response is not in a known format.");

    vi.mocked(apiRequest).mockResolvedValueOnce({ data: { passport: { project: {} } } });
    await expect(getOfficialProjectPassport("project-1")).rejects.toThrow("The passport detail response is not in a known format.");
  });

});