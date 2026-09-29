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
import { setProofBlockchainWriterFactory } from "../src/services/proof.service";
import { independentSha256 } from "./qa/fixtures";

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
      logicalKey: `${BlockchainEventType.ATTESTATION}:${project.id}:${project.id}`,
    },
  });
  createdEventIds.push(originalEvent.id);
  return { project, milestone, originalEvent };
}

afterEach(async () => {
  setProofBlockchainWriterFactory(undefined);
  const correctionIds = createdCorrectionIds.splice(0);
  const evidenceIds = createdEvidenceIds.splice(0);
  const eventIds = createdEventIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);

  if (correctionIds.length > 0) {
    await prisma.correctionResolution.deleteMany({ where: { correctionId: { in: correctionIds } } });
    await prisma.correction.deleteMany({ where: { id: { in: correctionIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.correctionResolution.deleteMany({
      where: { correction: { milestone: { projectId: { in: projectIds } } } },
    });
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
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
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
  if (projectIds.length > 0) {
    await prisma.blockchainEvent.deleteMany({ where: { projectId: { in: projectIds }, eventType: BlockchainEventType.CORRECTION } });
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
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
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
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
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

  it("returns 404 for an unknown milestone before correction mutation", async () => {
    const admin = await privileged(Role.ADMIN);
    const seededOwner = await registerContractor("Unknown milestone event owner");
    const seeded = await seedMilestone(seededOwner, "unknown-milestone");
    const response = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        milestoneId: "11111111-1111-4111-8111-111111111121",
        originalEventId: seeded.originalEvent.id,
        reason: "unknown milestone",
      });
    expect(response.status).toBe(404);
    expect(await prisma.correction.count({ where: { milestoneId: "11111111-1111-4111-8111-111111111121" } })).toBe(0);
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

  it("returns 404 for an unknown evidence record without creating a correction", async () => {
    const owner = await registerContractor("Unknown evidence owner");
    const seeded = await seedMilestone(owner, "unknown-evidence");
    const response = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        originalEventId: seeded.originalEvent.id,
        evidenceId: "11111111-1111-4111-8111-111111111119",
        reason: "unknown evidence reference",
      });
    expect(response.status).toBe(404);
    expect(await prisma.correction.count({ where: { milestoneId: seeded.milestone.id } })).toBe(0);
  });

  it("validates original events and evidence belong to the selected milestone project", async () => {
    const ownerA = await registerContractor("Reference owner A");
    const ownerB = await registerContractor("Reference owner B");
    const admin = await privileged(Role.ADMIN);
    const seededA = await seedMilestone(ownerA, "reference-a");
    const seededB = await seedMilestone(ownerB, "reference-b");
    const upload = await request(app).post("/api/v1/evidence")
      .set("Authorization", `Bearer ${ownerB.token}`)
      .field("milestoneId", seededB.milestone.id)
      .attach("file", Buffer.from("reference-b-bytes"), "b.txt");
    expect(upload.status).toBe(201);
    createdEvidenceIds.push(upload.body.data.evidence.id);
    const foreignEvidence = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ milestoneId: seededA.milestone.id, originalEventId: seededA.originalEvent.id, evidenceId: upload.body.data.evidence.id, reason: "foreign evidence" });
    expect(foreignEvidence.status).toBe(400);
    const foreignEvent = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ milestoneId: seededA.milestone.id, originalEventId: seededB.originalEvent.id, reason: "foreign event" });
    expect(foreignEvent.status).toBe(400);
    const missingEvent = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ milestoneId: seededA.milestone.id, originalEventId: "11111111-1111-4111-8111-111111111120", reason: "missing event" });
    expect(missingEvent.status).toBe(404);
    expect(await prisma.correction.count({ where: { milestoneId: seededA.milestone.id } })).toBe(0);
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
    expect(response.body.data.correction.status).toBe("OPEN");
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

  it("allows distinct correction requests for the same source record", async () => {
    const owner = await registerContractor("Duplicate corrections owner");
    const seeded = await seedMilestone(owner, "duplicate-corrections");
    for (const reason of ["first correction request", "second correction request"]) {
      const response = await request(app).post("/api/v1/corrections")
        .set("Authorization", `Bearer ${owner.token}`)
        .send({ milestoneId: seeded.milestone.id, originalEventId: seeded.originalEvent.id, reason });
      expect(response.status).toBe(201);
      createdCorrectionIds.push(response.body.data.correction.id);
    }
    expect(await prisma.correction.count({ where: { milestoneId: seeded.milestone.id } })).toBe(2);
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
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/corrections")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
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

describe("correction review, resolution, and history", () => {
  async function setupEvidenceCorrection(label: string) {
    const owner = await registerContractor(`${label} Owner`);
    const admin = await privileged(Role.ADMIN);
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, label);
    const firstBytes = Buffer.from(`${label}-original`);
    const uploaded = await request(app).post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", seeded.milestone.id)
      .attach("file", firstBytes, "original.txt");
    expect(uploaded.status).toBe(201);
    const evidenceId = uploaded.body.data.evidence.id as string;
    createdEvidenceIds.push(evidenceId);
    const originalVersionId = uploaded.body.data.evidence.currentVersionId as string;
    const originalHash = uploaded.body.data.evidence.sha256 as string;
    const originalVerification = await prisma.verification.create({
      data: {
        evidenceVersionId: originalVersionId,
        status: "MATCH",
        presentedSha256: originalHash,
        authoritativeSha256: originalHash,
        source: "INTERNAL",
        requestedById: admin.userId,
      },
    });
    const originalEvent = await prisma.blockchainEvent.create({
      data: {
        projectId: seeded.project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId: originalVersionId,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${seeded.project.id}:${originalVersionId}`,
        evidenceHash: originalHash,
        actorId: admin.userId,
        txHash: `0x${"a".repeat(64)}`,
        blockNumber: 10,
      },
    });
    createdEventIds.push(originalEvent.id);
    const correctedBytes = Buffer.from(`${label}-corrected`);
    const correctedUpload = await request(app).post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", seeded.milestone.id)
      .attach("file", correctedBytes, "corrected.txt");
    expect(correctedUpload.status).toBe(201);
    const correctedEvidenceId = correctedUpload.body.data.evidence.id as string;
    createdEvidenceIds.push(correctedEvidenceId);
    const created = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, originalEventId: originalEvent.id, evidenceId: correctedEvidenceId, reason: "correct the submitted file" });
    expect(created.status).toBe(201);
    createdCorrectionIds.push(created.body.data.correction.id);
    const correctedVersion = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { id: correctedUpload.body.data.evidence.currentVersionId },
    });
    return {
      owner, admin, auditor, seeded, evidenceId, originalVersionId, originalHash,
      originalVerification, originalEvent, correctionId: created.body.data.correction.id as string,
      correctedEvidenceId, correctedVersion, correctedHash: independentSha256(correctedBytes),
    };
  }

  it("resolves an approved correction with a later evidence version while preserving original history and Passport history", async () => {
    const item = await setupEvidenceCorrection("approve-correction");
    const originalEventBefore = await prisma.blockchainEvent.findUniqueOrThrow({ where: { id: item.originalEvent.id } });
    const originalVerificationBefore = await prisma.verification.findUniqueOrThrow({ where: { id: item.originalVerification.id } });
    const originalVersionBefore = await prisma.evidenceVersion.findUniqueOrThrow({ where: { id: item.originalVersionId } });
    const originalEvidenceBefore = await prisma.evidence.findUniqueOrThrow({ where: { id: item.evidenceId } });

    const reviewed = await request(app).post(`/api/v1/corrections/${item.correctionId}/review`)
      .set("Authorization", `Bearer ${item.admin.token}`).send({});
    expect(reviewed.status).toBe(200);
    expect(reviewed.body.data.correction.status).toBe("UNDER_REVIEW");

    const confirmedWriter = {
      isConfigured: () => true,
      canWrite: () => true,
      projectIsRegistered: async () => true,
      registerProject: async () => { throw new Error("unused"); },
      recordProof: async () => { throw new Error("unused"); },
      recordAttestation: async () => { throw new Error("unused"); },
      recordCorrection: async (input: { eventId: string; evidenceHash: string }) => ({
        txHash: `0x${"b".repeat(64)}`, blockNumber: 11, evidenceHash: input.evidenceHash,
        eventId: input.eventId, contractAddress: "0x0000000000000000000000000000000000000001",
      }),
      recordDispute: async () => { throw new Error("unused"); },
      recordResolution: async () => { throw new Error("unused"); },
    };
    setProofBlockchainWriterFactory(() => confirmedWriter);
    const body = { status: "APPROVED", resolution: "Corrected version accepted", correctedEvidenceVersionId: item.correctedVersion.id };
    const resolved = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`).send(body);
    expect(resolved.status).toBe(201);
    expect(resolved.body.data.correction.status).toBe("APPROVED");
    expect(resolved.body.data.resolution.correctedEvidenceVersion).toMatchObject({
      id: item.correctedVersion.id,
      versionNumber: 1,
      sha256: item.correctedHash,
    });
    expect(resolved.body.data.blockchainProof).toMatchObject({
      eventType: "CORRECTION", txHash: `0x${"b".repeat(64)}`, blockNumber: 11,
      confirmationState: "CONFIRMED", confirmed: true,
    });

    const retry = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`).send(body);
    expect(retry.status).toBe(201);
    expect(retry.body.data.resolution.id).toBe(resolved.body.data.resolution.id);
    const conflict = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ ...body, resolution: "different outcome" });
    expect(conflict.status).toBe(409);

    expect(await prisma.evidenceVersion.findUniqueOrThrow({ where: { id: item.originalVersionId } })).toMatchObject({
      sha256: item.originalHash, versionNumber: 1,
    });
    expect(await prisma.verification.findUniqueOrThrow({ where: { id: item.originalVerification.id } })).toMatchObject({
      id: item.originalVerification.id, status: "MATCH", authoritativeSha256: item.originalHash,
    });
    expect(await prisma.blockchainEvent.findUniqueOrThrow({ where: { id: item.originalEvent.id } })).toMatchObject({
      txHash: originalEventBefore.txHash, blockNumber: originalEventBefore.blockNumber,
      evidenceHash: originalEventBefore.evidenceHash,
    });
    expect(await prisma.evidence.findUniqueOrThrow({ where: { id: item.evidenceId } })).toMatchObject({
      id: originalEvidenceBefore.id, currentVersionId: originalEvidenceBefore.currentVersionId, sha256: item.originalHash,
    });
    expect(await prisma.correctionResolution.count({ where: { correctionId: item.correctionId } })).toBe(1);

    const passport = await request(app).get(`/api/v1/passports/${item.seeded.project.id}`)
      .set("Authorization", `Bearer ${item.owner.token}`);
    expect(passport.status).toBe(200);
    const correction = passport.body.data.passport.milestones[0].corrections[0];
    expect(correction.originalRecord.evidenceVersion).toMatchObject({ id: item.originalVersionId, sha256: item.originalHash });
    expect(correction.originalRecord.blockchainProof).toMatchObject({ txHash: originalEventBefore.txHash, confirmed: true });
    expect(correction.correctedEvidence.id).toBe(item.correctedEvidenceId);
    expect(correction.correctedEvidence.versions).toHaveLength(1);
    expect(correction.resolutions[0].correctedEvidenceVersion).toMatchObject({ id: item.correctedVersion.id, sha256: item.correctedHash });
    expect(correction.correctionProof).toMatchObject({ txHash: `0x${"b".repeat(64)}`, confirmed: true });
    expect(correction.correctedEvidence.versions[0]).toMatchObject({ id: item.correctedVersion.id, sha256: item.correctedHash });
  });

  it("denies correction detail and review across contractors and returns 404 for unknown corrections", async () => {
    const owner = await registerContractor("Correction IDOR owner");
    const outsider = await registerContractor("Correction IDOR outsider");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "correction-idor");
    const created = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, originalEventId: seeded.originalEvent.id, reason: "IDOR check" });
    expect(created.status).toBe(201);
    const correctionId = created.body.data.correction.id as string;
    createdCorrectionIds.push(correctionId);
    expect((await request(app).get(`/api/v1/corrections/${correctionId}`).set("Authorization", `Bearer ${owner.token}`)).status).toBe(200);
    expect((await request(app).get(`/api/v1/corrections/${correctionId}`).set("Authorization", `Bearer ${outsider.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/corrections/${correctionId}/review`).set("Authorization", `Bearer ${outsider.token}`).send({})).status).toBe(403);
    expect((await request(app).post(`/api/v1/corrections/${correctionId}/resolve`).set("Authorization", `Bearer ${outsider.token}`).send({ status: "REJECTED", resolution: "denied" })).status).toBe(403);
    const missing = await request(app).get("/api/v1/corrections/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(missing.status).toBe(404);
    expect((await request(app).get(`/api/v1/corrections/${correctionId}`)).status).toBe(401);
  });

  it("keeps approved correction unanchored when the source event is pending or corrected content is absent", async () => {
    const item = await setupEvidenceCorrection("pending-correction-proof");
    await prisma.blockchainEvent.update({ where: { id: item.originalEvent.id }, data: { txHash: null, blockNumber: null } });
    const response = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "APPROVED", resolution: "approved without source confirmation", correctedEvidenceVersionId: item.correctedVersion.id });
    expect(response.status).toBe(201);
    expect(response.body.data.correction.blockchainProof).toBeNull();
    expect(await prisma.blockchainEvent.count({ where: { projectId: item.seeded.project.id, eventType: BlockchainEventType.CORRECTION } })).toBe(0);
  });

  it("rejects invalid transitions and invalid corrected versions", async () => {
    const item = await setupEvidenceCorrection("invalid-correction-state");
    const contractorResolve = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.owner.token}`)
      .send({ status: "APPROVED", resolution: "contractor cannot decide", correctedEvidenceVersionId: item.correctedVersion.id });
    expect(contractorResolve.status).toBe(403);
    const invalidStatus = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "OPEN", resolution: "not terminal" });
    expect(invalidStatus.status).toBe(400);
    const originalAsCorrected = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "APPROVED", resolution: "must reject same source version", correctedEvidenceVersionId: item.originalVersionId });
    expect(originalAsCorrected.status).toBe(400);
    const unknownVersion = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "APPROVED", resolution: "missing version", correctedEvidenceVersionId: "11111111-1111-4111-8111-111111111111" });
    expect(unknownVersion.status).toBe(404);
    expect((await prisma.correction.findUniqueOrThrow({ where: { id: item.correctionId } })).status).toBe("OPEN");
  });

  it("leaves a failed correction transaction explicitly pending without false confirmation", async () => {
    const item = await setupEvidenceCorrection("failed-correction-chain");
    const failedWriter = {
      isConfigured: () => true,
      canWrite: () => true,
      projectIsRegistered: async () => true,
      registerProject: async () => { throw new Error("unused"); },
      recordProof: async () => { throw new Error("unused"); },
      recordAttestation: async () => { throw new Error("unused"); },
      recordCorrection: async () => { throw new Error("RPC unavailable"); },
      recordDispute: async () => { throw new Error("unused"); },
      recordResolution: async () => { throw new Error("unused"); },
    };
    setProofBlockchainWriterFactory(() => failedWriter);
    const response = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "APPROVED", resolution: "approved, chain unavailable", correctedEvidenceVersionId: item.correctedVersion.id });
    expect(response.status).toBe(201);
    expect(response.body.data.blockchainProof).toMatchObject({
      eventType: "CORRECTION", txHash: null, blockNumber: null,
      confirmationState: "PENDING", confirmed: false,
    });
    const event = await prisma.blockchainEvent.findUniqueOrThrow({
      where: { logicalKey: `CORRECTION:${item.seeded.project.id}:${item.correctionId}` },
    });
    expect(event.txHash).toBeNull();
    expect(event.blockNumber).toBeNull();
    setProofBlockchainWriterFactory(() => ({
      ...failedWriter,
      recordCorrection: async (input: { eventId: string; evidenceHash: string }) => ({
        txHash: `0x${"c".repeat(64)}`, blockNumber: 12, evidenceHash: input.evidenceHash,
        eventId: input.eventId, contractAddress: "0x0000000000000000000000000000000000000001",
      }),
    }));
    const retry = await request(app).post(`/api/v1/corrections/${item.correctionId}/resolve`)
      .set("Authorization", `Bearer ${item.admin.token}`)
      .send({ status: "APPROVED", resolution: "approved, chain unavailable", correctedEvidenceVersionId: item.correctedVersion.id });
    expect(retry.status).toBe(201);
    expect(retry.body.data.resolution.id).toBe(response.body.data.resolution.id);
    expect(retry.body.data.blockchainProof).toMatchObject({ txHash: `0x${"c".repeat(64)}`, blockNumber: 12, confirmed: true });
    expect(await prisma.blockchainEvent.count({ where: { logicalKey: event.logicalKey } })).toBe(1);
  });

  it("supports a persisted REJECTED outcome and refuses a later conflicting approval", async () => {
    const owner = await registerContractor("Rejected correction owner");
    const reviewer = await privileged(Role.PROCUREMENT_OFFICER);
    const seeded = await seedMilestone(owner, "rejected-correction");
    const created = await request(app).post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ milestoneId: seeded.milestone.id, originalEventId: seeded.originalEvent.id, reason: "wrong contract reference" });
    expect(created.status).toBe(201);
    const correctionId = created.body.data.correction.id as string;
    createdCorrectionIds.push(correctionId);
    const resolved = await request(app).post(`/api/v1/corrections/${correctionId}/resolve`)
      .set("Authorization", `Bearer ${reviewer.token}`)
      .send({ status: "REJECTED", resolution: "The supplied reference was not applicable" });
    expect(resolved.status).toBe(201);
    expect(resolved.body.data.correction.status).toBe("REJECTED");
    expect(resolved.body.data.resolution.resolvedByRole).toBe("PROCUREMENT_OFFICER");
    expect(resolved.body.data.blockchainProof).toBeNull();
    const conflict = await request(app).post(`/api/v1/corrections/${correctionId}/resolve`)
      .set("Authorization", `Bearer ${reviewer.token}`)
      .send({ status: "APPROVED", resolution: "different outcome" });
    expect(conflict.status).toBe(409);
    expect(await prisma.correctionResolution.count({ where: { correctionId } })).toBe(1);
  });
});
