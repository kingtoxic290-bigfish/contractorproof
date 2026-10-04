import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { contractorPassportFixture, contractorRecord } from "../../../tests/fixtures";
import {
  getContractor,
  getContractorPassport,
  getOwnContractorPassport,
  listContractors,
  searchContractorsByCrbRegistrationNumber,
} from "./contractorsApi";

vi.mock("../../../services/api/client", () => ({
  apiRequest: vi.fn(),
}));

const harbor = contractorRecord({
  id: "c1",
  legalName: "Harbor Works Ltd",
  crbRegistrationNumber: null,
  crbCategory: null,
});

const quay = contractorRecord({
  id: "c2",
  legalName: "Quay Construction",
});

describe("contractorsApi envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("unwraps a contractors collection envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [harbor] });

    await expect(listContractors()).resolves.toEqual([harbor]);
    expect(apiRequest).toHaveBeenCalledWith("/contractors");
  });

  it("consumes a real collection containing contractors with a null crbSource", async () => {
    // The API returns crbSource: null until a CRB check has actually run, so a
    // single such record must not reject the whole collection.
    const unchecked = { ...harbor, id: "c3", crbSource: null };

    vi.mocked(apiRequest).mockResolvedValue({ contractors: [harbor, quay, unchecked] });

    await expect(listContractors()).resolves.toEqual([harbor, quay, unchecked]);
  });

  it("accepts a collection of contractors that have never been CRB checked", async () => {
    const allUnchecked = [harbor, quay].map((record) => ({ ...record, crbSource: null }));

    vi.mocked(apiRequest).mockResolvedValue({ contractors: allUnchecked });

    await expect(listContractors()).resolves.toEqual(allUnchecked);
  });

  it("unwraps multiple contractor records", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [harbor, quay] });

    await expect(listContractors()).resolves.toEqual([harbor, quay]);
  });

  it("unwraps an empty contractors collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [] });

    await expect(listContractors()).resolves.toEqual([]);
  });

  it("accepts a contractor record that omits the linked account", async () => {
    // The API may return identity and registration fields only. Discovery must
    // not depend on a nested user object being present.
    const { userId, user, ...withoutAccount } = harbor;
    void userId;
    void user;

    vi.mocked(apiRequest).mockResolvedValue({ contractors: [withoutAccount] });

    await expect(listContractors()).resolves.toEqual([withoutAccount]);
  });

  it("unwraps a contractor detail envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractor: harbor });

    await expect(getContractor("c1")).resolves.toEqual(harbor);
    expect(apiRequest).toHaveBeenCalledWith("/contractors/c1");
  });

  it("rejects a raw contractor array", async () => {
    vi.mocked(apiRequest).mockResolvedValue([harbor]);

    await expect(listContractors()).rejects.toThrow(
      "The contractor list response is not in a known format.",
    );
  });

  it("keeps null CRB fields as null", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractor: harbor });

    const contractor = await getContractor("c1");
    expect(contractor.crbRegistrationNumber).toBeNull();
    expect(contractor.crbCategory).toBeNull();
    expect(contractor.crbType).toBeNull();
    expect(contractor.crbClass).toBeNull();
    expect(contractor.crbStatus).toBeNull();
    expect(contractor.crbLastVerifiedAt).toBeNull();
  });
});

describe("contractorsApi discovery and passport envelopes", () => {
  beforeEach(() => {
    vi.mocked(apiRequest).mockReset();
  });

  it("searches by CRB Registration Number through the contractors collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [harbor] });

    await expect(searchContractorsByCrbRegistrationNumber("CRB-204")).resolves.toEqual([harbor]);
    expect(apiRequest).toHaveBeenCalledWith("/contractors?crbRegistrationNumber=CRB-204");
  });

  it("encodes the registration number and trims client input", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [] });

    await searchContractorsByCrbRegistrationNumber("  CRB/204  ");
    expect(apiRequest).toHaveBeenCalledWith("/contractors?crbRegistrationNumber=CRB%2F204");
  });

  it("returns an empty array for a search with no ContractorProof match", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [] });

    await expect(searchContractorsByCrbRegistrationNumber("CRB-000")).resolves.toEqual([]);
  });

  it("rejects a search response it cannot understand", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ results: [harbor] });

    await expect(searchContractorsByCrbRegistrationNumber("CRB-204")).rejects.toThrow(
      "The contractor list response is not in a known format.",
    );
  });

  it("unwraps a contractor passport envelope", async () => {
    const passport = contractorPassportFixture();
    vi.mocked(apiRequest).mockResolvedValue({ contractorPassport: passport });

    await expect(getContractorPassport("c1")).resolves.toEqual(passport);
    expect(apiRequest).toHaveBeenCalledWith("/contractors/c1/passport");
  });

  it("resolves the own-passport route without an identifier", async () => {
    const passport = contractorPassportFixture();
    vi.mocked(apiRequest).mockResolvedValue({ contractorPassport: passport });

    await expect(getOwnContractorPassport()).resolves.toEqual(passport);
    expect(apiRequest).toHaveBeenCalledWith("/contractors/me/passport");
  });

  it("rejects a passport payload that omits the projection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({});

    await expect(getContractorPassport("c1")).rejects.toThrow(
      "The contractor passport response is not in a known format.",
    );
  });

  it("accepts a passport that does not disclose the linked account", async () => {
    // The passport endpoint is allowed to omit the account block. Requiring it
    // made every such response unparseable.
    const passport = contractorPassportFixture();
    delete (passport.contractor as { account?: unknown }).account;
    vi.mocked(apiRequest).mockResolvedValue({ contractorPassport: passport });

    await expect(getContractorPassport("c1")).resolves.toMatchObject({
      contractor: { legalName: "Harbor Works Ltd", account: { role: "" } },
    });
  });

  it("ignores unknown extra keys and keeps the factual fields", async () => {
    const passport = contractorPassportFixture() as unknown as Record<string, unknown>;
    passport.somethingNew = { nested: true };

    vi.mocked(apiRequest).mockResolvedValue({ contractorPassport: passport });
    await expect(getContractorPassport("c1")).resolves.toMatchObject({
      scope: { containsRatings: false },
      contractor: { legalName: "Harbor Works Ltd", crbRegistrationNumber: "CRB-204" },
    });
  });

  it("rejects a passport whose totals are not counts", async () => {
    const passport = contractorPassportFixture();
    passport.totals.projects = "many" as unknown as number;

    vi.mocked(apiRequest).mockResolvedValue({ contractorPassport: passport });
    await expect(getContractorPassport("c1")).rejects.toThrow(
      "The contractor passport response is not in a known format.",
    );
  });
});
