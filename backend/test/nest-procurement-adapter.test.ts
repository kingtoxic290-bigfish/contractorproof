import { describe, expect, it } from "vitest";
import {
  NestAdapterError,
  normalizeOcdsRecordPackage,
} from "../src/integrations/nest/NestProcurementAdapter";
import { PublicOcdsNestAdapter, isAllowedNestOcdsBase } from "../src/integrations/nest/PublicOcdsNestAdapter";
import { sandboxNestAdapter } from "../src/integrations/nest/SandboxNestAdapter";

const ocid = "ocds-tz-demo-abcdef";

function release(id: string, releaseDate: string, tenderStatus: string) {
  return {
    ocid,
    id,
    date: releaseDate,
    tag: ["tender"],
    buyer: { id: "ORG-DEMO-01", name: "DEMO Public Works Unit" },
    tender: {
      id: "TN-DEMO-01",
      title: "DEMO: Culvert rehabilitation",
      description: "Fictional representative OCDS fixture.",
      status: tenderStatus,
      mainProcurementCategory: "works",
    },
    awards: [{
      id: "AWARD-DEMO-01",
      status: "active",
      date: "2026-02-01T00:00:00Z",
      suppliers: [{ id: "SUPPLIER-DEMO-01", name: "DEMO Fictional Works Ltd" }],
    }],
    contracts: [{
      id: "CONTRACT-DEMO-01",
      status: "active",
      awardID: "AWARD-DEMO-01",
      value: { amount: 1250.5, currency: "TZS" },
      period: { startDate: "2026-03-01", endDate: "2027-02-28" },
    }],
  };
}

function recordPackage() {
  return {
    uri: `https://nest.go.tz/ocds/${ocid}`,
    version: "1.1",
    publishedDate: "2026-10-01T00:00:00Z",
    publisher: { name: "NeST Data Portal", scheme: "TZ-PPRA" },
    license: "public data portal terms",
    records: [{
      ocid,
      id: "record-demo-01",
      date: "2026-10-01T00:00:00Z",
      releases: [
        release("release-demo-01", "2026-01-10T00:00:00Z", "active"),
        release("release-demo-02", "2026-02-10T00:00:00Z", "complete"),
      ],
    }],
  };
}

describe("NeST procurement adapters", () => {
  it("returns deterministic, explicitly sandbox procurement releases", async () => {
    const first = await sandboxNestAdapter.lookupByOcid("ocds-sandbox-001");
    const second = await sandboxNestAdapter.lookupByOcid("ocds-sandbox-001");
    expect(first).toEqual(second);
    expect(first.sourceSystem).toBe("SANDBOX_DEMO");
    expect(first.observations).toHaveLength(2);
    expect(first.observations[1]?.contractorName).toMatch(/^DEMO /);
    expect(first.observations[1]?.releaseId).toBe("release-001-award");
  });

  it("normalizes an OCDS Record Package and preserves each release ID", () => {
    const normalized = normalizeOcdsRecordPackage(recordPackage(), ocid);
    expect(normalized.sourceRecordId).toBe("record-demo-01");
    expect(normalized.observations).toHaveLength(2);
    expect(normalized.observations.map((item) => item.releaseId)).toEqual([
      "release-demo-01",
      "release-demo-02",
    ]);
    expect(normalized.observations[1]).toMatchObject({
      ocid,
      tenderReference: "TN-DEMO-01",
      buyerIdentifier: "ORG-DEMO-01",
      awardStatus: "active",
      contractReference: "CONTRACT-DEMO-01",
      contractorName: "DEMO Fictional Works Ltd",
      contractorIdentifier: "SUPPLIER-DEMO-01",
      contractValue: "1250.5",
      contractCurrency: "TZS",
    });
    expect(normalized.observations[0]?.sourceDigest).not.toBe(normalized.observations[1]?.sourceDigest);
  });

  it("rejects malformed packages and mismatched OCIDs", () => {
    expect(() => normalizeOcdsRecordPackage({ releases: [] }, ocid)).toThrow(NestAdapterError);
    expect(() => normalizeOcdsRecordPackage({ records: [{ ocid: "other", releases: [] }] }, ocid))
      .toThrow(/requested OCID/);
    expect(() => normalizeOcdsRecordPackage({ records: [{ ocid, releases: [{ id: "missing-ocid" }] }] }, ocid))
      .toThrow(/different OCID/);
  });

  it("accepts only the exact configured NeST HTTPS host and API path", () => {
    expect(isAllowedNestOcdsBase("https://nest.go.tz/gateway/nest-data-portal-api/api/")).toBe(true);
    for (const base of [
      "http://nest.go.tz/gateway/nest-data-portal-api/api/",
      "https://evil.example/gateway/nest-data-portal-api/api/",
      "https://nest.go.tz.evil.example/gateway/nest-data-portal-api/api/",
      "https://localhost/gateway/nest-data-portal-api/api/",
      "https://nest.go.tz/other/",
      "https://user:password@nest.go.tz/gateway/nest-data-portal-api/api/",
    ]) {
      expect(isAllowedNestOcdsBase(base)).toBe(false);
    }
  });

  it("reports a bounded request timeout as NEST_TIMEOUT", async () => {
    const fetchImpl = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })) as typeof fetch;
    const adapter = new PublicOcdsNestAdapter(undefined, fetchImpl, 5);
    await expect(adapter.lookupByOcid(ocid)).rejects.toMatchObject({ code: "NEST_TIMEOUT" });
  });

  it("does not make a linked contractor association from the supplier name", async () => {
    const lookup = await sandboxNestAdapter.lookupByOcid("ocds-sandbox-001");
    expect(lookup.observations[1]?.contractorName).toBe("DEMO Fictional Builder Ltd");
    expect(lookup).not.toHaveProperty("contractorId");
    expect(lookup).not.toHaveProperty("contractorProofId");
  });
});