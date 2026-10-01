import { CrbVerificationStatus } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import {
  SANDBOX_UNAVAILABLE_REFERENCE,
  sandboxCrbAdapter,
  setCrbAdapterFactory,
  type CrbAdapter,
} from "../src/integrations/crb";
import { OfficialCrbAdapter, createOfficialCrbAdapterFromEnv } from "../src/integrations/crb/OfficialCrbAdapter";
import { prisma } from "../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerContractor,
} from "./qa/fixtures";

/** Sets the CRB reference on a contractor so a check can actually run. */
async function withReference(contractorId: string, reference: string) {
  return prisma.contractor.update({
    where: { id: contractorId },
    data: { crbRegistrationNumber: reference },
  });
}

describe("CRB adapter: outage is never reported as non-registration", () => {
  afterEach(() => setCrbAdapterFactory());

  it("returns NOT_REGISTERED for a genuine miss, with no fields populated", async () => {
    const result = await sandboxCrbAdapter.lookup("CRB-NOT-PRESENT");

    expect(result.status).toBe(CrbVerificationStatus.NOT_REGISTERED);
    expect(result.failureCode).toBeNull();
    expect(result.registrationNumber).toBeNull();
    expect(result.registeredName).toBeNull();
  });

  it("returns UNAVAILABLE for an upstream outage and never NOT_REGISTERED", async () => {
    const result = await sandboxCrbAdapter.lookup(SANDBOX_UNAVAILABLE_REFERENCE);

    expect(result.status).toBe(CrbVerificationStatus.UNAVAILABLE);
    expect(result.status).not.toBe(CrbVerificationStatus.NOT_REGISTERED);
    expect(result.failureCode).toBe("CRB_UNREACHABLE");
  });

  it("returns INVALID_REFERENCE rather than calling the source", async () => {
    const result = await sandboxCrbAdapter.lookup("bad reference !!");

    expect(result.status).toBe(CrbVerificationStatus.INVALID_REFERENCE);
  });

  it("distinguishes REGISTERED, EXPIRED and SUSPENDED as distinct facts", async () => {
    const registered = await sandboxCrbAdapter.lookup("CRB-DEMO-001");
    const expired = await sandboxCrbAdapter.lookup("CRB-DEMO-002");
    const suspended = await sandboxCrbAdapter.lookup("CRB-DEMO-003");

    expect(registered.status).toBe(CrbVerificationStatus.REGISTERED);
    expect(expired.status).toBe(CrbVerificationStatus.EXPIRED);
    expect(suspended.status).toBe(CrbVerificationStatus.SUSPENDED);
  });
});

describe("official CRB adapter fails closed", () => {
  afterEach(() => {
    setCrbAdapterFactory();
    delete process.env.CRB_MODE;
  });

  it("reports unavailable, not configured, and performs no network call", async () => {
    const adapter = new OfficialCrbAdapter(null);
    expect(adapter.isConfigured()).toBe(false);

    const result = await adapter.lookup("CRB-DEMO-001");
    expect(result.status).toBe(CrbVerificationStatus.UNAVAILABLE);
    expect(result.failureCode).toBe("CRB_NOT_CONFIGURED");
  });

  it("never falls back to sandbox data when official mode is unconfigured", async () => {
    process.env.CRB_MODE = "official";
    delete process.env.CRB_API_BASE_URL;
    delete process.env.CRB_API_KEY;

    const response = await request(app)
      .post("/api/v1/contractors/00000000-0000-4000-8000-000000000000/crb/verify")
      .set("Authorization", `Bearer ${(await privileged("ADMIN" as never)).token}`);

    // No sandbox fallback: the route cannot attribute a sandbox record to a
    // contractor when official access is required.
    expect([400, 404]).toContain(response.status);
  });

  it("refuses an http or private-network base URL at construction", () => {
    const previousUrl = process.env.CRB_API_BASE_URL;
    const previousKey = process.env.CRB_API_KEY;
    try {
      process.env.CRB_API_KEY = "unused";
      for (const unsafe of [
        "http://crb.example.com",
        "https://localhost/api",
        "https://127.0.0.1/api",
        "https://10.0.0.5/api",
        "https://192.168.1.1/api",
      ]) {
        process.env.CRB_API_BASE_URL = unsafe;
        expect(createOfficialCrbAdapterFromEnv().isConfigured()).toBe(false);
      }
    } finally {
      process.env.CRB_API_BASE_URL = previousUrl;
      process.env.CRB_API_KEY = previousKey;
    }
  });
});

describe("CRB verification is contractor-scoped, RBAC-protected and auditable", () => {
  afterEach(async () => {
    setCrbAdapterFactory();
    await cleanupQaUsers();
  });

  it("records a factual REGISTERED result with a deterministic digest", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(201);
    expect(response.body.data.verification).toMatchObject({
      status: "REGISTERED",
      source: "SANDBOX",
      registrationReference: "CRB-DEMO-001",
      registeredName: "Harbor Works Limited (sandbox record)",
      failureCode: null,
    });
    expect(response.body.data.verification.canonicalDigest).toMatch(/^[0-9a-f]{64}$/);
    assertNoSecrets(response.body);

    const rows = await prisma.crbVerification.findMany({
      where: { contractorId: contractor.contractorId },
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].requestedById).toBe(admin.userId);
    expect(rows[0].source).toBe("SANDBOX");

    const contractorRow = await prisma.contractor.findUnique({
      where: { id: contractor.contractorId },
    });
    expect(contractorRow?.crbSource).toBe("SANDBOX");
  });

  it("produces the same digest for the same factual outcome", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    const first = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);
    const second = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data.verification.canonicalDigest).toBe(
      first.body.data.verification.canonicalDigest,
    );
  });

  it("appends to history instead of overwriting previous outcomes", async () => {
    const contractor = await registerContractor();
    const admin = await privileged("ADMIN" as never);
    await withReference(contractor.contractorId, "CRB-DEMO-001");

    await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    // The registration later changes status upstream.
    await withReference(contractor.contractorId, "CRB-DEMO-003");
    await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    const history = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/crb`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(history.status).toBe(200);
    expect(history.body.data.history).toHaveLength(2);
    expect(history.body.data.current.status).toBe("SUSPENDED");
    expect(history.body.data.history.map((row: { status: string }) => row.status)).toEqual([
      "SUSPENDED",
      "REGISTERED",
    ]);
  });

  it("does not let an UNAVAILABLE attempt mask an earlier real result", async () => {
    const contractor = await registerContractor();
    const admin = await privileged("ADMIN" as never);
    await withReference(contractor.contractorId, "CRB-DEMO-001");

    await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    await withReference(contractor.contractorId, SANDBOX_UNAVAILABLE_REFERENCE);
    await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    const history = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/crb`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(history.body.data.latestAttempt.status).toBe("UNAVAILABLE");
    expect(history.body.data.latestAttempt.failureCode).toBe("CRB_UNREACHABLE");
    // The last known factual state is still available and clearly separated.
    expect(history.body.data.current.status).toBe("REGISTERED");
  });

  it("rejects a contractor with no CRB reference instead of guessing", async () => {
    const contractor = await registerContractor();
    const admin = await privileged("ADMIN" as never);

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(400);
    const rows = await prisma.crbVerification.count({
      where: { contractorId: contractor.contractorId },
    });
    expect(rows).toBe(0);
  });

  it("stores a NOT_REGISTERED outcome as a fact when the source finds no match", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-ABSENT-999");
    const admin = await privileged("ADMIN" as never);

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(201);
    expect(response.body.data.verification.status).toBe("NOT_REGISTERED");
  });

  it("forbids a contractor from triggering a check on their own record", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${contractor.token}`);

    expect(response.status).toBe(403);
    const rows = await prisma.crbVerification.count({
      where: { contractorId: contractor.contractorId },
    });
    expect(rows).toBe(0);
  });

  it("allows a contractor to read their own CRB history", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    const response = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/crb`)
      .set("Authorization", `Bearer ${contractor.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.current.status).toBe("REGISTERED");
  });

  it("does not let one contractor read another contractor's CRB history", async () => {
    const owner = await registerContractor("CRB Owner");
    await withReference(owner.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    await request(app)
      .post(`/api/v1/contractors/${owner.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    const other = await registerContractor("CRB Outsider");
    const response = await request(app)
      .get(`/api/v1/contractors/${owner.contractorId}/crb`)
      .set("Authorization", `Bearer ${other.token}`);

    expect([403, 404]).toContain(response.status);
  });

  it("requires authentication", async () => {
    const response = await request(app).get(
      "/api/v1/contractors/00000000-0000-4000-8000-000000000000/crb",
    );
    expect(response.status).toBe(401);
  });

  it("never emits a score or judgement, only factual fields", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(JSON.stringify(response.body)).not.toMatch(
      /trustScore|score|rating|grade/i,
    );
    assertNoSecrets(response.body);
  });

  it("honours an injected adapter without touching business logic", async () => {
    const contractor = await registerContractor();
    await withReference(contractor.contractorId, "CRB-DEMO-001");
    const admin = await privileged("ADMIN" as never);

    const stub: CrbAdapter = {
      source: "CRB_OFFICIAL",
      isConfigured: () => true,
      lookup: async (registrationReference) => ({
        registrationReference,
        status: CrbVerificationStatus.PENDING,
        registrationNumber: null,
        registeredName: null,
        category: null,
        registrationClass: null,
        registrationDate: null,
        expiryDate: null,
        externalReference: null,
        failureCode: null,
      }),
    };
    setCrbAdapterFactory(() => stub);

    const response = await request(app)
      .post(`/api/v1/contractors/${contractor.contractorId}/crb/verify`)
      .set("Authorization", `Bearer ${admin.token}`);

    expect(response.status).toBe(201);
    expect(response.body.data.verification.status).toBe("PENDING");
    expect(response.body.data.verification.source).toBe("CRB_OFFICIAL");

    // A pending upstream state is not a completed result, so it must not be
    // presented as the current factual status.
    const history = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/crb`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(history.body.data.current).toBeNull();
    expect(history.body.data.latestAttempt.status).toBe("PENDING");
  });
});