import { unlink } from "fs/promises";
import path from "path";
import { Role } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/repositories/prisma";
import { sha256Buffer } from "../src/utils/hash";
import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";

type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdEvidenceIds: string[] = [];
const createdStorageKeys: string[] = [];

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
  expect(serialized).not.toMatch(/trustScore|riskScore|confidenceScore|safetyScore/);
}

async function registerAccount(
  role: "CONTRACTOR" | "CLIENT" | "CONSULTANT_ENGINEER",
  fullName: string,
): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName,
    role,
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
  };
}

async function createPrivileged(role: Role.ADMIN | Role.AUDITOR | Role.PROCUREMENT_OFFICER): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123"),
      fullName: `${role} Verifier`,
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

async function contractorIdForUser(userId: string): Promise<string> {
  const contractor = await prisma.contractor.findUnique({ where: { userId } });
  if (!contractor) {
    throw new Error("expected contractor");
  }
  return contractor.id;
}

async function seedEvidence(ownerUserId: string, label: string) {
  const contractorId = await contractorIdForUser(ownerUserId);
  const project = await prisma.project.create({
    data: { contractorId, name: `${label} Project`, nestSource: "SYNTHETIC_DEMO" },
  });
  createdProjectIds.push(project.id);
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, name: `${label} Milestone` },
  });
  const owner = await prisma.user.findUnique({ where: { id: ownerUserId } });
  const token = signAccessToken({
    sub: owner!.id,
    email: owner!.email,
    role: owner!.role,
  });
  const contents = Buffer.from(`${label}-evidence-bytes`);
  const created = await request(app)
    .post("/api/v1/evidence")
    .set("Authorization", `Bearer ${token}`)
    .field("milestoneId", milestone.id)
    .attach("file", contents, `${label}.txt`);
  expect(created.status).toBe(201);
  createdEvidenceIds.push(created.body.data.evidence.id);
  const row = await prisma.evidence.findUnique({
    where: { id: created.body.data.evidence.id },
    include: { versions: true },
  });
  if (row?.storageKey) {
    createdStorageKeys.push(row.storageKey);
  }
  for (const version of row?.versions ?? []) {
    createdStorageKeys.push(version.storageReference);
  }
  return {
    project,
    milestone,
    evidenceId: created.body.data.evidence.id as string,
    versionId: created.body.data.evidence.currentVersionId as string,
    contents,
  };
}

afterEach(async () => {
  const evidenceIds = createdEvidenceIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);
  const storageKeys = [...new Set(createdStorageKeys.splice(0))];

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
  await Promise.all(
    storageKeys.map((key) =>
      unlink(path.join(env.storagePath, path.basename(key))).catch(() => undefined),
    ),
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/v1/verification", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/verification").send({
      evidenceId: "11111111-1111-4111-8111-111111111111",
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", "Bearer not-a-valid-token")
      .send({ evidenceId: "11111111-1111-4111-8111-111111111111" });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
  });

  it("returns 400 when evidenceId and evidenceVersionId are missing", async () => {
    const auditor = await createPrivileged(Role.AUDITOR);
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed evidence ID", async () => {
    const auditor = await createPrivileged(Role.AUDITOR);
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: "not-a-uuid" });
    expect(response.status).toBe(400);
  });

  it("forbids CONTRACTOR from verifying their own evidence", async () => {
    const owner = await registerAccount("CONTRACTOR", "Self Verify Owner");
    const seeded = await seedEvidence(owner.userId, "self");
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ evidenceId: seeded.evidenceId });
    expect(response.status).toBe(403);
    assertSafePayload(response.body);
  });

  it("forbids CONTRACTOR from verifying another contractor's evidence", async () => {
    const owner = await registerAccount("CONTRACTOR", "Target Owner");
    const other = await registerAccount("CONTRACTOR", "Other Contractor");
    const seeded = await seedEvidence(owner.userId, "other");
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${other.token}`)
      .send({ evidenceId: seeded.evidenceId });
    expect(response.status).toBe(403);
  });

  it("forbids an unauthorized role from verifying", async () => {
    const owner = await registerAccount("CONTRACTOR", "Client Target");
    const client = await registerAccount("CLIENT", "Client Verifier");
    const seeded = await seedEvidence(owner.userId, "client-target");
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ evidenceId: seeded.evidenceId });
    expect(response.status).toBe(403);
  });

  it("does not allow authorization to be bypassed by swapping evidence IDs", async () => {
    const ownerA = await registerAccount("CONTRACTOR", "Owner A");
    const ownerB = await registerAccount("CONTRACTOR", "Owner B");
    const seededA = await seedEvidence(ownerA.userId, "a");
    const seededB = await seedEvidence(ownerB.userId, "b");

    const own = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({ evidenceId: seededA.evidenceId });
    expect(own.status).toBe(403);

    const swapped = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({ evidenceId: seededB.evidenceId, evidenceVersionId: seededB.versionId });
    expect(swapped.status).toBe(403);
  });

  it("lets an authorized verifier compare fingerprints through VerificationService", async () => {
    const owner = await registerAccount("CONTRACTOR", "Audited Owner");
    const auditor = await createPrivileged(Role.AUDITOR);
    const seeded = await seedEvidence(owner.userId, "audit");

    const match = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: seeded.evidenceId });

    expect(match.status).toBe(200);
    expect(match.body).toMatchObject({
      data: {
        verification: {
          status: "MATCH",
          source: "INTERNAL",
          evidenceId: seeded.evidenceId,
          evidenceVersionId: seeded.versionId,
          sha256: sha256Buffer(seeded.contents),
        },
      },
      meta: {},
    });
    expect(match.body.data.verification.id).toEqual(expect.any(String));
    expect(match.body.data.verification.status).not.toBe("VERIFIED");
    expect(match.body.data.verification.status).not.toBe("PENDING_VERIFICATION");
    assertSafePayload(match.body);

    const row = await prisma.verification.findUnique({
      where: { id: match.body.data.verification.id },
    });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("MATCH");
    expect(row!.source).toBe("INTERNAL");
    expect(row!.requestedById).toBe(auditor.userId);

    const evidence = await prisma.evidence.findUnique({ where: { id: seeded.evidenceId } });
    expect(evidence!.status).toBe("PENDING_VERIFICATION");

    const mismatch = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceVersionId", seeded.versionId)
      .attach("file", Buffer.from("tampered-bytes"), "tampered.txt");
    expect(mismatch.status).toBe(200);
    expect(mismatch.body.data.verification.status).toBe("MISMATCH");
    expect(mismatch.body.data.verification.source).toBe("INTERNAL");

    const after = await prisma.evidence.findUnique({ where: { id: seeded.evidenceId } });
    expect(after!.status).toBe("PENDING_VERIFICATION");
  });

  it("lets PROCUREMENT_OFFICER verify accessible evidence", async () => {
    const owner = await registerAccount("CONTRACTOR", "Procurement Target");
    const officer = await createPrivileged(Role.PROCUREMENT_OFFICER);
    const seeded = await seedEvidence(owner.userId, "procurement");
    const response = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({ evidenceVersionId: seeded.versionId });
    expect(response.status).toBe(200);
    expect(response.body.data.verification.status).toBe("MATCH");
    expect(response.body.data.verification.source).toBe("INTERNAL");
  });

  it("does not activate the stale plural route", async () => {
    const auditor = await createPrivileged(Role.AUDITOR);
    const response = await request(app)
      .post("/api/v1/verifications")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: "11111111-1111-4111-8111-111111111111" });
    expect(response.status).not.toBe(200);
    expect(response.status).not.toBe(201);
    expect(response.body.data?.verification).toBeUndefined();
  });
});
