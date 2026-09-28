import { BlockchainEventType, Role } from "@prisma/client";
import { createHash } from "node:crypto";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";
import { setProofBlockchainWriterFactory } from "../src/services/proof.service";

type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdDisputeIds: string[] = [];
const createdEvidenceIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function assertSafePayload(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/storageKey/i);
  expect(serialized).not.toMatch(/storageReference/i);
  expect(serialized).not.toMatch(/storage\//i);
  expect(serialized).not.toMatch(/\/home\//);
  expect(serialized).not.toMatch(/trustScore|riskScore|confidenceScore|safetyScore|contractorScore/);
}

async function registerContractor(fullName: string): Promise<Account & { contractorId: string }> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("contractor"),
    password: "password123",
    fullName,
    role: "CONTRACTOR",
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  const contractor = await prisma.contractor.findUnique({
    where: { userId: response.body.user.id },
  });
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
    contractorId: contractor!.id,
  };
}

async function registerClient(fullName: string): Promise<Account> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("client"),
    password: "password123",
    fullName,
    role: "CLIENT",
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
  };
}

async function privileged(role: Role): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123"),
      fullName: `${role} Dispute`,
      role,
    },
  });
  createdUserIds.push(user.id);
  return {
    token: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    userId: user.id,
    email: user.email,
  };
}

async function seedMilestone(owner: Account & { contractorId: string }, label: string) {
  const project = await prisma.project.create({
    data: { contractorId: owner.contractorId, name: `${label} Project` },
  });
  createdProjectIds.push(project.id);
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, name: `${label} Milestone` },
  });
  return { project, milestone };
}

async function seedEvidenceWithMatch(milestoneId: string, actorId: string) {
  const bytes = Buffer.from("immutable dispute evidence");
  const hash = createHash("sha256").update(bytes).digest("hex");
  const evidence = await prisma.evidence.create({
    data: {
      milestoneId,
      uploadedById: actorId,
      fileName: "immutable.txt",
      storageKey: "test-only-storage-reference",
      mimeType: "text/plain",
      sizeBytes: bytes.length,
      sha256: hash,
    },
  });
  createdEvidenceIds.push(evidence.id);
  const version = await prisma.evidenceVersion.create({
    data: {
      evidenceId: evidence.id,
      versionNumber: 1,
      storageReference: "test-only-version-reference",
      fileName: "immutable.txt",
      mimeType: "text/plain",
      sizeBytes: bytes.length,
      sha256: hash,
      createdById: actorId,
    },
  });
  await prisma.evidence.update({ where: { id: evidence.id }, data: { currentVersionId: version.id } });
  const verification = await prisma.verification.create({
    data: {
      evidenceVersionId: version.id,
      status: "MATCH",
      presentedSha256: hash,
      authoritativeSha256: hash,
      source: "INTERNAL",
      requestedById: actorId,
    },
  });
  return { evidence, version, verification, hash };
}

afterEach(async () => {
  const disputeIds = createdDisputeIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const evidenceIds = createdEvidenceIds.splice(0);
  const userIds = createdUserIds.splice(0);

  if (disputeIds.length > 0) {
    await prisma.disputeResolution.deleteMany({ where: { disputeId: { in: disputeIds } } });
    await prisma.dispute.deleteMany({ where: { id: { in: disputeIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.disputeResolution.deleteMany({
      where: { dispute: { milestone: { projectId: { in: projectIds } } } },
    });
    await prisma.dispute.deleteMany({ where: { milestone: { projectId: { in: projectIds } } } });
    await prisma.blockchainEvent.deleteMany({
      where: { projectId: { in: projectIds }, eventType: { in: ["RESOLUTION", "DISPUTE"] } },
    });
    await prisma.blockchainEvent.deleteMany({ where: { projectId: { in: projectIds } } });
  }
  if (evidenceIds.length > 0) {
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.milestone.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.contractor.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/v1/disputes", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/disputes").send({
      milestoneId: "11111111-1111-4111-8111-111111111111",
      reason: "work does not match the drawing",
    });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", "Bearer not-a-valid-token")
      .send({
        milestoneId: "11111111-1111-4111-8111-111111111111",
        reason: "work does not match the drawing",
      });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 400 when required fields are missing", async () => {
    const owner = await registerContractor("Missing Fields Owner");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed milestone UUID", async () => {
    const owner = await registerContractor("Bad Uuid Owner");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: "not-a-uuid",
        reason: "work does not match the drawing",
      });
    expect(response.status).toBe(400);
  });

  it("forbids an unauthorized role from creating a dispute", async () => {
    const owner = await registerContractor("Auditor Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "auditor-create");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "auditor should not raise this",
      });
    expect(response.status).toBe(403);
  });

  it("forbids a contractor from creating a dispute on another contractor's project", async () => {
    const owner = await registerContractor("Owner A");
    const other = await registerContractor("Owner B");
    const seeded = await seedMilestone(owner, "cross-create");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        evidenceId: "11111111-1111-4111-8111-111111111111",
        projectId: seeded.project.id,
        contractorId: owner.contractorId,
        reason: "attempted cross-project dispute",
      });
    expect(response.status).toBe(403);
  });

  it("does not let changing milestoneId bypass contractor isolation", async () => {
    const ownerA = await registerContractor("Swap Owner A");
    const ownerB = await registerContractor("Swap Owner B");
    const seededA = await seedMilestone(ownerA, "swap-a");
    const seededB = await seedMilestone(ownerB, "swap-b");

    const swapped = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({
        milestoneId: seededB.milestone.id,
        projectId: seededA.project.id,
        evidenceId: "11111111-1111-4111-8111-111111111199",
        reason: "id swap",
      });
    expect(swapped.status).toBe(403);
  });

  it("persists a dispute for the owning contractor using the JWT identity", async () => {
    const owner = await registerContractor("Raise Owner");
    const other = await registerContractor("Impersonation Target");
    const seeded = await seedMilestone(owner, "raise");

    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "progress claim does not match site works",
        raisedById: other.userId,
        actorId: other.userId,
        userId: other.userId,
        status: "RESOLVED",
        role: "ADMIN",
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        dispute: {
          milestoneId: seeded.milestone.id,
          raisedById: owner.userId,
          status: "OPEN",
          reason: "progress claim does not match site works",
        },
      },
      meta: {},
    });
    expect(response.body.data.dispute.id).toEqual(expect.any(String));
    expect(response.body.data.dispute.raisedById).not.toBe(other.userId);
    expect(response.body.data.dispute.status).not.toBe("RESOLVED");
    assertSafePayload(response.body);
    createdDisputeIds.push(response.body.data.dispute.id);

    const row = await prisma.dispute.findUnique({
      where: { id: response.body.data.dispute.id },
    });
    expect(row).not.toBeNull();
    expect(row!.raisedById).toBe(owner.userId);
    expect(row!.milestoneId).toBe(seeded.milestone.id);
    expect(row!.status).toBe("OPEN");
    expect(row!.originalEventId).toBeNull();
    expect(row!.evidenceId).toBeNull();
    expect(row!.resolutionEventId).toBeNull();
  });

  it("allows ADMIN to create a dispute on a contractor project", async () => {
    const owner = await registerContractor("Admin Target");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "admin-raise");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "admin recorded a dispute",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.dispute.raisedById).toBe(admin.userId);
    expect(response.body.data.dispute.status).toBe("OPEN");
    createdDisputeIds.push(response.body.data.dispute.id);
  });

  it("forbids CLIENT without project membership from creating a dispute", async () => {
    const owner = await registerContractor("Client Target");
    const client = await registerClient("No Membership Client");
    const seeded = await seedMilestone(owner, "client-block");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "client has no membership",
      });
    expect(response.status).toBe(403);
  });

  it("validates evidence references and preserves the original record", async () => {
    const owner = await registerContractor("Evidence dispute owner");
    const seeded = await seedMilestone(owner, "evidence-dispute");
    const evidenceData = await seedEvidenceWithMatch(seeded.milestone.id, owner.userId);
    const before = await prisma.verification.findUniqueOrThrow({ where: { id: evidenceData.verification.id } });
    const missing = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, evidenceId: "11111111-1111-4111-8111-111111111111", reason: "missing evidence" });
    expect(missing.status).toBe(404);
    const created = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, evidenceId: evidenceData.evidence.id, reason: "challenge evidence" });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);
    expect(created.body.data.dispute.evidenceId).toBe(evidenceData.evidence.id);
    expect(await prisma.evidence.findUniqueOrThrow({ where: { id: evidenceData.evidence.id } })).toMatchObject({
      sha256: evidenceData.hash,
      currentVersionId: evidenceData.version.id,
    });
    expect(await prisma.evidenceVersion.findUniqueOrThrow({ where: { id: evidenceData.version.id } })).toMatchObject({
      sha256: evidenceData.hash,
      versionNumber: 1,
    });
    expect(await prisma.verification.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject({
      id: before.id,
      status: "MATCH",
      authoritativeSha256: before.authoritativeSha256,
    });
  });

  it("does not create a dispute for a forbidden project", async () => {
    const owner = await registerContractor("No-mutation owner");
    const outsider = await registerContractor("No-mutation outsider");
    const seeded = await seedMilestone(owner, "no-mutation");
    const before = await prisma.dispute.count({ where: { milestoneId: seeded.milestone.id } });
    const response = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${outsider.token}`)
      .send({ milestoneId: seeded.milestone.id, reason: "must be denied" });
    expect(response.status).toBe(403);
    expect(await prisma.dispute.count({ where: { milestoneId: seeded.milestone.id } })).toBe(before);
  });

  it("allows distinct dispute records when the domain permits repeated challenges", async () => {
    const owner = await registerContractor("Repeated disputes owner");
    const seeded = await seedMilestone(owner, "repeated-disputes");
    for (const reason of ["first challenge", "second challenge"]) {
      const response = await request(app).post("/api/v1/disputes")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ milestoneId: seeded.milestone.id, reason });
      expect(response.status).toBe(201);
      createdDisputeIds.push(response.body.data.dispute.id);
    }
    expect(await prisma.dispute.count({ where: { milestoneId: seeded.milestone.id } })).toBe(2);
  });
});

describe("GET /api/v1/disputes", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/disputes");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 400 for a malformed filter UUID", async () => {
    const owner = await registerContractor("Filter Owner");
    const response = await request(app)
      .get("/api/v1/disputes")
      .query({ milestoneId: "not-a-uuid" })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(400);
  });

  it("returns an empty canonical list when the contractor has no disputes", async () => {
    const owner = await registerContractor("Empty Owner");
    await seedMilestone(owner, "empty");
    const response = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { disputes: [] }, meta: {} });
  });

  it("lists only disputes the contractor can access", async () => {
    const owner = await registerContractor("List Owner");
    const other = await registerContractor("List Other");
    const seeded = await seedMilestone(owner, "list-own");
    const otherSeeded = await seedMilestone(other, "list-other");

    const own = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "own dispute",
      });
    expect(own.status).toBe(201);
    createdDisputeIds.push(own.body.data.dispute.id);

    const foreign = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: otherSeeded.milestone.id,
        reason: "foreign dispute",
      });
    expect(foreign.status).toBe(201);
    createdDisputeIds.push(foreign.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.disputes).toHaveLength(1);
    expect(listed.body.data.disputes[0].id).toBe(own.body.data.dispute.id);
    expect(listed.body.data.disputes.map((row: { id: string }) => row.id)).not.toContain(
      foreign.body.data.dispute.id,
    );
    assertSafePayload(listed.body);

    const swapped = await request(app)
      .get("/api/v1/disputes")
      .query({
        milestoneId: otherSeeded.milestone.id,
        projectId: otherSeeded.project.id,
      })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(swapped.status).toBe(200);
    expect(swapped.body).toEqual({ data: { disputes: [] }, meta: {} });
  });

  it("lets a privileged reader see accessible disputes", async () => {
    const owner = await registerContractor("Reader Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "reader");
    const created = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "visible to auditor",
      });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.disputes.some((row: { id: string }) => row.id === created.body.data.dispute.id)).toBe(
      true,
    );
  });

  it("returns an empty list for CLIENT until membership exists", async () => {
    const owner = await registerContractor("Client List Target");
    const client = await registerClient("List Client");
    const seeded = await seedMilestone(owner, "client-list");
    const created = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "hidden from client",
      });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${client.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ data: { disputes: [] }, meta: {} });
  });

  it("returns 404 for unknown dispute detail and denies cross-project detail access", async () => {
    const owner = await registerContractor("Detail owner");
    const other = await registerContractor("Detail other");
    const seeded = await seedMilestone(owner, "detail");
    const created = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, reason: "detail access" });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);
    const own = await request(app).get(`/api/v1/disputes/${created.body.data.dispute.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(own.status).toBe(200);
    expect(own.body.data.dispute.id).toBe(created.body.data.dispute.id);
    const forbidden = await request(app).get(`/api/v1/disputes/${created.body.data.dispute.id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(forbidden.status).toBe(403);
    const missing = await request(app).get("/api/v1/disputes/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(missing.status).toBe(404);
    const unauthenticated = await request(app).get(`/api/v1/disputes/${created.body.data.dispute.id}`);
    expect(unauthenticated.status).toBe(401);
  });
});

describe("dispute review and resolution", () => {
  it("appends a resolution once and preserves evidence versions and verification history", async () => {
    const owner = await registerContractor("Resolution owner");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "resolution");
    const original = await seedEvidenceWithMatch(seeded.milestone.id, owner.userId);
    const created = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, evidenceId: original.evidence.id, reason: "challenge a match" });
    expect(created.status).toBe(201);
    const disputeId = created.body.data.dispute.id as string;
    createdDisputeIds.push(disputeId);

    const review = await request(app).post(`/api/v1/disputes/${disputeId}/review`)
      .set("Authorization", `Bearer ${admin.token}`).send({});
    expect(review.status).toBe(200);
    expect(review.body.data.dispute.status).toBe("UNDER_REVIEW");
    const resolved = await request(app).post(`/api/v1/disputes/${disputeId}/resolutions`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "REJECTED", resolution: "The submitted challenge was reviewed" });
    expect(resolved.status).toBe(201);
    expect(resolved.body.data.dispute.status).toBe("REJECTED");
    expect(resolved.body.data.resolution).toMatchObject({ status: "REJECTED", resolvedById: admin.userId });
    const retry = await request(app).post(`/api/v1/disputes/${disputeId}/resolutions`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "REJECTED", resolution: "The submitted challenge was reviewed" });
    expect(retry.status).toBe(201);
    expect(retry.body.data.resolution.id).toBe(resolved.body.data.resolution.id);
    const conflict = await request(app).post(`/api/v1/disputes/${disputeId}/resolutions`)
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ status: "RESOLVED", resolution: "Conflicting second outcome" });
    expect(conflict.status).toBe(409);

    expect(await prisma.disputeResolution.count({ where: { disputeId } })).toBe(1);
    expect(await prisma.evidence.findUniqueOrThrow({ where: { id: original.evidence.id } })).toMatchObject({
      sha256: original.hash,
      currentVersionId: original.version.id,
    });
    expect(await prisma.evidenceVersion.findUniqueOrThrow({ where: { id: original.version.id } })).toMatchObject({
      sha256: original.hash,
      versionNumber: 1,
    });
    expect(await prisma.verification.findUniqueOrThrow({ where: { id: original.verification.id } })).toMatchObject({
      id: original.verification.id,
      status: "MATCH",
    });
  });

  it("denies unauthorized resolution and malformed outcomes", async () => {
    const owner = await registerContractor("No resolution owner");
    const seeded = await seedMilestone(owner, "no-resolution");
    const created = await request(app).post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, reason: "challenge" });
    createdDisputeIds.push(created.body.data.dispute.id);
    const denied = await request(app).post(`/api/v1/disputes/${created.body.data.dispute.id}/resolutions`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ status: "RESOLVED", resolution: "not permitted" });
    expect(denied.status).toBe(403);
    const invalid = await request(app).post(`/api/v1/disputes/${created.body.data.dispute.id}/resolutions`)
      .set("Authorization", `Bearer ${(await privileged(Role.ADMIN)).token}`)
      .send({ status: "OPEN", resolution: "invalid terminal result" });
    expect(invalid.status).toBe(400);
    expect((await prisma.dispute.findUniqueOrThrow({ where: { id: created.body.data.dispute.id } })).status).toBe("OPEN");
  });

  it("keeps a failed optional blockchain anchor pending without claiming confirmation", async () => {
    const owner = await registerContractor("Pending dispute owner");
    const seeded = await seedMilestone(owner, "pending-dispute");
    const original = await prisma.blockchainEvent.create({
      data: {
        projectId: seeded.project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId: "original-verification",
        logicalKey: `test:original:${seeded.project.id}`,
        txHash: `0x${"1".repeat(64)}`,
        blockNumber: 1,
      },
    });
    const failedWriter = {
      isConfigured: () => true,
      canWrite: () => true,
      projectIsRegistered: async () => true,
      registerProject: async () => { throw new Error("unused"); },
      recordProof: async () => { throw new Error("unused"); },
      recordAttestation: async () => { throw new Error("unused"); },
      recordDispute: async () => { throw new Error("RPC unavailable"); },
      recordResolution: async () => { throw new Error("unused"); },
    };
    setProofBlockchainWriterFactory(() => failedWriter);
    try {
      const response = await request(app).post("/api/v1/disputes")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ milestoneId: seeded.milestone.id, originalEventId: original.id, reason: "chain may be offline" });
      expect(response.status).toBe(201);
      createdDisputeIds.push(response.body.data.dispute.id);
      expect(response.body.data.dispute.blockchainProof).toMatchObject({
        eventType: "DISPUTE",
        confirmationState: "PENDING",
        confirmed: false,
        txHash: null,
        blockNumber: null,
      });
      const event = await prisma.blockchainEvent.findUniqueOrThrow({
        where: { logicalKey: `DISPUTE:${seeded.project.id}:${response.body.data.dispute.id}` },
      });
      expect(event.txHash).toBeNull();
      expect(event.blockNumber).toBeNull();
    } finally {
      setProofBlockchainWriterFactory(undefined);
    }
  });

  it("confirms dispute and resolution events only after successful writer receipts", async () => {
    const owner = await registerContractor("Confirmed dispute owner");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "confirmed-dispute");
    const original = await prisma.blockchainEvent.create({
      data: {
        projectId: seeded.project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId: "confirmed-original",
        logicalKey: `test:confirmed-original:${seeded.project.id}`,
        txHash: `0x${"3".repeat(64)}`,
        blockNumber: 3,
      },
    });
    const successfulWriter = {
      isConfigured: () => true,
      canWrite: () => true,
      projectIsRegistered: async () => true,
      registerProject: async () => { throw new Error("unused"); },
      recordProof: async () => { throw new Error("unused"); },
      recordAttestation: async () => { throw new Error("unused"); },
      recordDispute: async () => ({ txHash: `0x${"4".repeat(64)}`, blockNumber: 4, evidenceHash: null }),
      recordResolution: async () => ({ txHash: `0x${"5".repeat(64)}`, blockNumber: 5, evidenceHash: null }),
    };
    setProofBlockchainWriterFactory(() => successfulWriter);
    try {
      const created = await request(app).post("/api/v1/disputes")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ milestoneId: seeded.milestone.id, originalEventId: original.id, reason: "record on chain" });
      expect(created.status).toBe(201);
      createdDisputeIds.push(created.body.data.dispute.id);
      expect(created.body.data.dispute.blockchainProof).toMatchObject({
        eventType: "DISPUTE", txHash: `0x${"4".repeat(64)}`, blockNumber: 4,
        confirmationState: "CONFIRMED", confirmed: true,
      });
      const resolved = await request(app).post(`/api/v1/disputes/${created.body.data.dispute.id}/resolutions`)
        .set("Authorization", `Bearer ${admin.token}`)
        .send({ status: "RESOLVED", resolution: "Resolution recorded" });
      expect(resolved.status).toBe(201);
      expect(resolved.body.data.blockchainProof).toMatchObject({
        eventType: "RESOLUTION", txHash: `0x${"5".repeat(64)}`, blockNumber: 5,
        confirmationState: "CONFIRMED", confirmed: true,
      });
      expect(await prisma.blockchainEvent.count({
        where: { projectId: seeded.project.id, eventType: { in: ["DISPUTE", "RESOLUTION"] }, txHash: { not: null } },
      })).toBe(2);
    } finally {
      setProofBlockchainWriterFactory(undefined);
    }
  });
});
