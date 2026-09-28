import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "../../../services/api/client";
import { contractorRecord } from "../../../tests/fixtures";
import { getContractor, listContractors } from "./contractorsApi";

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

  it("unwraps multiple contractor records", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [harbor, quay] });

    await expect(listContractors()).resolves.toEqual([harbor, quay]);
  });

  it("unwraps an empty contractors collection", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [] });

    await expect(listContractors()).resolves.toEqual([]);
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

  it("rejects a malformed contractor row instead of dropping it", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractors: [{ id: "c1", legalName: "Incomplete" }] });

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

  it("rejects a contractor with a wrong-typed optional field", async () => {
    vi.mocked(apiRequest).mockResolvedValue({ contractor: { ...harbor, crbStatus: 7 } });

    await expect(getContractor("c1")).rejects.toThrow(
      "The contractor response is not in a known format.",
    );
  });
});
