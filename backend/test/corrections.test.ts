import { unlink } from "fs/promises";
import path from "path";
import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/repositories/prisma";
import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";

type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdCorrectionIds: string[] = [];
const createdEventIds: string[] = [];
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
  expect(serialized).not.toMatch(/txHash|blockNumber/);
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
      fullName: `${role} Correction`,
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
  const originalEvent = await prisma.blockchainEvent.create({
    data: {
      projectId: project.id,
      eventType: BlockchainEventType.ATTESTATION,
    },
  });
  createdEventIds.push(originalEvent.id);
  return { project, milestone, originalEvent };
}

afterEach(async () => {
  const correctionIds = createdCorrectionIds.splice(0);
  const evidenceIds = createdEvidenceIds.splice(0);
  const eventIds = createdEventIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);

  if (correctionIds.length > 0) {
    await prisma.correction.deleteMany({ where: { id: { in: correctionIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.correction.deleteMany({ where: { milestone: { projectId: { in: projectIds } } } });
  }
  if (evidenceIds.length > 0) {
    const evidence = await prisma.evidence.findMany({
      where: { id: { in: evidenceIds } },
      include: { versions: true },
    });
    const storageKeys = [
      ...evidence.map((row) => row.storageKey).filter((key): key is string => Boolean(key)),
      ...evidence.flatMap((row) => row.versions.map((version) => version.storageReference)),
    ];
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
    await Promise.all(
      [...new Set(storageKeys)].map((key) =>
        unlink(path.join(env.storagePath, path.basename(key))).catch(() => undefined),
      ),
    );
  }
  if (eventIds.length > 0) {
    await prisma.blockchainEvent.deleteMany({ where: { id: { in: eventIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.blockchainEvent.deleteMany({ where: { projectId: { in: projectIds } } });
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

describe("POST /api/v1/corrections", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/corrections").send({
      milestoneId: "11111111-1111-4111-8111-111111111111",
      originalEventId: "11111111-1111-4111-8111-111111111112",
      reason: "drawing revision",
    });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", "Bearer not-a-valid-token")
      .send({
        milestoneId: "11111111-1111-4111-8111-111111111111",
        originalEventId: "11111111-1111-4111-8111-111111111112",
        reason: "drawing revision",
      });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 400 when required fields are missing", async () => {
    const owner = await registerContractor("Missing Fields Owner");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed milestone UUID", async () => {
    const owner = await registerContractor("Bad Uuid Owner");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: "not-a-uuid",
        originalEventId: "11111111-1111-4111-8111-111111111112",
        reason: "drawing revision",
      });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed originalEventId", async () => {
    const owner = await registerContractor("Bad Event Owner");
    const seeded = await seedMilestone(owner, "bad-event");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: "not-an-event",
        reason: "drawing revision",
      });
    expect(response.status).toBe(400);
  });

  it("forbids an unauthorized role from creating a correction", async () => {
    const owner = await registerContractor("Auditor Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "auditor-create");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "auditor should not raise this",
      });
    expect(response.status).toBe(403);
  });

  it("forbids a contractor from creating a correction on another contractor's project", async () => {
    const owner = await registerContractor("Owner A");
    const other = await registerContractor("Owner B");
    const seeded = await seedMilestone(owner, "cross-create");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        projectId: seeded.project.id,
        contractorId: owner.contractorId,
        reason: "attempted cross-project correction",
      });
    expect(response.status).toBe(403);
  });

  it("does not let changing milestoneId bypass contractor isolation", async () => {
    const ownerA = await registerContractor("Swap Owner A");
    const ownerB = await registerContractor("Swap Owner B");
    const seededA = await seedMilestone(ownerA, "swap-a");
    const seededB = await seedMilestone(ownerB, "swap-b");

    const swapped = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({
        milestoneId: seededB.milestone.id,
        originalEventId: seededA.originalEvent.id,
        projectId: seededA.project.id,
        reason: "id swap",
      });
    expect(swapped.status).toBe(403);
  });

  it("persists a correction for the owning contractor using the JWT identity", async () => {
    const owner = await registerContractor("Raise Owner");
    const other = await registerContractor("Impersonation Target");
    const seeded = await seedMilestone(owner, "raise");

    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "as-built drawing supersedes issued set",
        actorId: other.userId,
        userId: other.userId,
        createdById: other.userId,
        correctedById: other.userId,
        role: "ADMIN",
        status: "APPLIED",
        decision: "APPROVED",
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        correction: {
          milestoneId: seeded.milestone.id,
          originalEventId: seeded.originalEvent.id,
          actorId: owner.userId,
          evidenceId: null,
          reason: "as-built drawing supersedes issued set",
        },
      },
      meta: {},
    });
    expect(response.body.data.correction.id).toEqual(expect.any(String));
    expect(response.body.data.correction.actorId).not.toBe(other.userId);
    expect(response.body.data.correction.status).toBeUndefined();
    expect(response.body.data.correction.decision).toBeUndefined();
    assertSafePayload(response.body);
    createdCorrectionIds.push(response.body.data.correction.id);

    const row = await prisma.correction.findUnique({
      where: { id: response.body.data.correction.id },
    });
    expect(row).not.toBeNull();
    expect(row!.actorId).toBe(owner.userId);
    expect(row!.milestoneId).toBe(seeded.milestone.id);
    expect(row!.originalEventId).toBe(seeded.originalEvent.id);
    expect(row!.evidenceId).toBeNull();

    const versions = await prisma.evidenceVersion.count({
      where: { evidence: { milestoneId: seeded.milestone.id } },
    });
    expect(versions).toBe(0);
  });

  it("allows ADMIN to create a correction and optionally link evidence on the same milestone", async () => {
    const owner = await registerContractor("Admin Target");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "admin-raise");
    const upload = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", seeded.milestone.id)
      .attach("file", Buffer.from("correction-bytes"), "asbuilt.txt");
    expect(upload.status).toBe(201);
    createdEvidenceIds.push(upload.body.data.evidence.id);

    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        evidenceId: upload.body.data.evidence.id,
        reason: "admin recorded a correction",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.correction.actorId).toBe(admin.userId);
    expect(response.body.data.correction.evidenceId).toBe(upload.body.data.evidence.id);
    createdCorrectionIds.push(response.body.data.correction.id);

    const versions = await prisma.evidenceVersion.findMany({
      where: { evidenceId: upload.body.data.evidence.id },
    });
    expect(versions).toHaveLength(1);
    expect(versions[0]!.versionNumber).toBe(1);
  });

  it("forbids CLIENT without project membership from creating a correction", async () => {
    const owner = await registerContractor("Client Target");
    const client = await registerClient("No Membership Client");
    const seeded = await seedMilestone(owner, "client-block");
    const response = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "client has no membership",
      });
    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/corrections", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/corrections");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/corrections")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 400 for a malformed filter UUID", async () => {
    const owner = await registerContractor("Filter Owner");
    const response = await request(app)
      .get("/api/v1/corrections")
      .query({ milestoneId: "not-a-uuid" })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(400);
  });

  it("returns an empty canonical list when the contractor has no corrections", async () => {
    const owner = await registerContractor("Empty Owner");
    await seedMilestone(owner, "empty");
    const response = await request(app)
      .get("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { corrections: [] }, meta: {} });
  });

  it("lists only corrections the contractor can access", async () => {
    const owner = await registerContractor("List Owner");
    const other = await registerContractor("List Other");
    const seeded = await seedMilestone(owner, "list-own");
    const otherSeeded = await seedMilestone(other, "list-other");

    const own = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "own correction",
      });
    expect(own.status).toBe(201);
    createdCorrectionIds.push(own.body.data.correction.id);

    const foreign = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: otherSeeded.milestone.id,
        originalEventId: otherSeeded.originalEvent.id,
        reason: "foreign correction",
      });
    expect(foreign.status).toBe(201);
    createdCorrectionIds.push(foreign.body.data.correction.id);

    const listed = await request(app)
      .get("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.corrections).toHaveLength(1);
    expect(listed.body.data.corrections[0].id).toBe(own.body.data.correction.id);
    expect(listed.body.data.corrections.map((row: { id: string }) => row.id)).not.toContain(
      foreign.body.data.correction.id,
    );
    assertSafePayload(listed.body);

    const swapped = await request(app)
      .get("/api/v1/corrections")
      .query({
        milestoneId: otherSeeded.milestone.id,
        projectId: otherSeeded.project.id,
      })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(swapped.status).toBe(200);
    expect(swapped.body).toEqual({ data: { corrections: [] }, meta: {} });
  });

  it("lets a privileged reader see accessible corrections", async () => {
    const owner = await registerContractor("Reader Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "reader");
    const created = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "visible to auditor",
      });
    expect(created.status).toBe(201);
    createdCorrectionIds.push(created.body.data.correction.id);

    const listed = await request(app)
      .get("/api/v1/corrections")
      .query({ milestoneId: seeded.milestone.id })
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.corrections).toHaveLength(1);
    expect(listed.body.data.corrections[0].id).toBe(created.body.data.correction.id);
  });

  it("returns an empty list for CLIENT until membership exists", async () => {
    const owner = await registerContractor("Client List Target");
    const client = await registerClient("List Client");
    const seeded = await seedMilestone(owner, "client-list");
    const created = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        reason: "hidden from client",
      });
    expect(created.status).toBe(201);
    createdCorrectionIds.push(created.body.data.correction.id);

    const listed = await request(app)
      .get("/api/v1/corrections")
      .set("Authorization", `Bearer ${client.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ data: { corrections: [] }, meta: {} });
  });
});
