import { unlink } from "fs/promises";
import path from "path";
import { Role } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/repositories/prisma";
import { EVIDENCE_MAX_FILE_BYTES } from "../src/services/evidence";
import { sha256Buffer } from "../src/utils/hash";
import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";

type RegisteredAccount = {
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

function assertSafeEvidencePayload(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/"password"\s*:/);
  expect(serialized).not.toMatch(/storageKey/i);
  expect(serialized).not.toMatch(/storageReference/i);
  expect(serialized).not.toMatch(/storage\//i);
  expect(serialized).not.toMatch(/\/home\//);
  expect(serialized).not.toMatch(/trustScore|riskScore|safetyScore|confidenceScore|reputationScore/);
}

async function registerAccount(
  role: "CONTRACTOR" | "CLIENT",
  fullName: string,
): Promise<RegisteredAccount> {
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

async function createAdmin(): Promise<RegisteredAccount> {
  const email = uniqueEmail("admin");
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123"),
      fullName: "Evidence Admin",
      role: Role.ADMIN,
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
    throw new Error(`expected contractor for user ${userId}`);
  }
  return contractor.id;
}

async function createProject(contractorId: string, name: string) {
  const project = await prisma.project.create({
    data: {
      contractorId,
      name,
      description: `${name} description`,
      nestSource: "SYNTHETIC_DEMO",
    },
  });
  createdProjectIds.push(project.id);
  return project;
}

async function createMilestone(projectId: string, name: string) {
  return prisma.milestone.create({
    data: {
      projectId,
      name,
      description: `${name} description`,
    },
  });
}

async function trackEvidence(evidenceId: string): Promise<void> {
  createdEvidenceIds.push(evidenceId);
  const row = await prisma.evidence.findUnique({
    where: { id: evidenceId },
    include: { versions: true },
  });
  if (row?.storageKey) {
    createdStorageKeys.push(row.storageKey);
  }
  for (const version of row?.versions ?? []) {
    createdStorageKeys.push(version.storageReference);
  }
}

function uploadFile(
  token: string,
  fields: { milestoneId?: string; filename?: string; contents?: Buffer },
) {
  const req = request(app)
    .post("/api/v1/evidence")
    .set("Authorization", `Bearer ${token}`);
  if (fields.milestoneId !== undefined) {
    req.field("milestoneId", fields.milestoneId);
  }
  if (fields.contents !== undefined) {
    req.attach("file", fields.contents, fields.filename ?? "site.txt");
  }
  return req;
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

describe("POST /api/v1/evidence", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/evidence");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
  });

  it("returns 400 when the multipart file is missing", async () => {
    const account = await registerAccount("CONTRACTOR", "Missing File Contractor");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Missing File Project");
    const milestone = await createMilestone(project.id, "Missing File Milestone");

    const response = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${account.token}`)
      .field("milestoneId", milestone.id);

    expect(response.status).toBe(400);
  });

  it("returns 400 when milestoneId is missing", async () => {
    const account = await registerAccount("CONTRACTOR", "Missing Milestone Contractor");
    const response = await uploadFile(account.token, {
      contents: Buffer.from("no-milestone"),
      filename: "site.txt",
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed milestoneId", async () => {
    const account = await registerAccount("CONTRACTOR", "Bad Id Contractor");
    const response = await uploadFile(account.token, {
      milestoneId: "not-a-uuid",
      contents: Buffer.from("bad-id"),
      filename: "site.txt",
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 for an empty file", async () => {
    const account = await registerAccount("CONTRACTOR", "Empty File Contractor");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Empty File Project");
    const milestone = await createMilestone(project.id, "Empty File Milestone");

    const response = await uploadFile(account.token, {
      milestoneId: milestone.id,
      contents: Buffer.alloc(0),
      filename: "empty.txt",
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 for an oversized file", async () => {
    const account = await registerAccount("CONTRACTOR", "Oversize Contractor");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Oversize Project");
    const milestone = await createMilestone(project.id, "Oversize Milestone");

    const response = await uploadFile(account.token, {
      milestoneId: milestone.id,
      contents: Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1, 1),
      filename: "huge.txt",
    });
    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed multipart input without crashing", async () => {
    const account = await registerAccount("CONTRACTOR", "Malformed Contractor");
    const response = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${account.token}`)
      .set("Content-Type", "multipart/form-data; boundary=----broken")
      .send("this is not a valid multipart body");
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
  });

  it("allows a contractor to create evidence on their own project", async () => {
    const account = await registerAccount("CONTRACTOR", "Owner Contractor");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Owner Project");
    const milestone = await createMilestone(project.id, "Owner Milestone");
    const contents = Buffer.from("owner-site-photo-bytes");
    const expectedHash = sha256Buffer(contents);

    const response = await uploadFile(account.token, {
      milestoneId: milestone.id,
      contents,
      filename: "site.txt",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        evidence: {
          milestoneId: milestone.id,
          fileName: "site.txt",
          sha256: expectedHash,
          status: "PENDING_VERIFICATION",
          verificationStatus: "PENDING",
        },
      },
      meta: {},
    });
    expect(response.body.data.evidence.id).toEqual(expect.any(String));
    expect(response.body.data.evidence.currentVersionId).toEqual(expect.any(String));
    assertSafeEvidencePayload(response.body);
    await trackEvidence(response.body.data.evidence.id);

    const row = await prisma.evidence.findUnique({
      where: { id: response.body.data.evidence.id },
      include: { currentVersion: true, versions: true },
    });
    expect(row).not.toBeNull();
    expect(row!.status).toBe("PENDING_VERIFICATION");
    expect(row!.currentVersionId).toBe(row!.currentVersion!.id);
    expect(row!.versions).toHaveLength(1);
    expect(row!.versions[0]?.versionNumber).toBe(1);
    expect(row!.sha256).toBe(expectedHash);
    expect(row!.currentVersion!.sha256).toBe(expectedHash);
  });

  it("forbids a contractor from creating evidence on another contractor's project", async () => {
    const owner = await registerAccount("CONTRACTOR", "Project Owner");
    const other = await registerAccount("CONTRACTOR", "Other Contractor");
    const ownerContractorId = await contractorIdForUser(owner.userId);
    const project = await createProject(ownerContractorId, "Owned Project");
    const milestone = await createMilestone(project.id, "Owned Milestone");

    const response = await uploadFile(other.token, {
      milestoneId: milestone.id,
      contents: Buffer.from("idor-attempt"),
      filename: "site.txt",
    });
    expect(response.status).toBe(403);
  });

  it("allows ADMIN to create evidence on another contractor's project", async () => {
    const owner = await registerAccount("CONTRACTOR", "Admin Target Contractor");
    const admin = await createAdmin();
    const contractorId = await contractorIdForUser(owner.userId);
    const project = await createProject(contractorId, "Admin Target Project");
    const milestone = await createMilestone(project.id, "Admin Target Milestone");
    const contents = Buffer.from("admin-uploaded-bytes");

    const response = await uploadFile(admin.token, {
      milestoneId: milestone.id,
      contents,
      filename: "admin.txt",
    });
    expect(response.status).toBe(201);
    expect(response.body.data.evidence.sha256).toBe(sha256Buffer(contents));
    expect(response.body.data.evidence.status).toBe("PENDING_VERIFICATION");
    assertSafeEvidencePayload(response.body);
    await trackEvidence(response.body.data.evidence.id);
  });

  it("forbids an unrelated authenticated role from creating evidence", async () => {
    const owner = await registerAccount("CONTRACTOR", "Client Target Contractor");
    const client = await registerAccount("CLIENT", "Unrelated Client");
    const contractorId = await contractorIdForUser(owner.userId);
    const project = await createProject(contractorId, "Client Target Project");
    const milestone = await createMilestone(project.id, "Client Target Milestone");

    const response = await uploadFile(client.token, {
      milestoneId: milestone.id,
      contents: Buffer.from("client-should-not-upload"),
      filename: "site.txt",
    });
    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/evidence", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/evidence");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
  });

  it("returns an empty accessible collection", async () => {
    const account = await registerAccount("CONTRACTOR", "Empty List Contractor");
    const response = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${account.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { evidence: [] }, meta: {} });
  });

  it("returns only evidence the contractor can access", async () => {
    const ownerA = await registerAccount("CONTRACTOR", "Isolation A");
    const ownerB = await registerAccount("CONTRACTOR", "Isolation B");
    const auditor = await createAdmin();
    const projectA = await createProject(await contractorIdForUser(ownerA.userId), "Project A");
    const projectB = await createProject(await contractorIdForUser(ownerB.userId), "Project B");
    const milestoneA = await createMilestone(projectA.id, "Milestone A");
    const milestoneB = await createMilestone(projectB.id, "Milestone B");

    const createdA = await uploadFile(ownerA.token, {
      milestoneId: milestoneA.id,
      contents: Buffer.from("evidence-a-bytes"),
      filename: "a.txt",
    });
    const createdB = await uploadFile(ownerB.token, {
      milestoneId: milestoneB.id,
      contents: Buffer.from("evidence-b-bytes"),
      filename: "b.txt",
    });
    expect(createdA.status).toBe(201);
    expect(createdB.status).toBe(201);
    await trackEvidence(createdA.body.data.evidence.id);
    await trackEvidence(createdB.body.data.evidence.id);

    const listA = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(listA.status).toBe(200);
    expect(listA.body.data.evidence).toHaveLength(1);
    expect(listA.body.data.evidence[0].id).toBe(createdA.body.data.evidence.id);
    expect(listA.body.data.evidence.map((row: { id: string }) => row.id)).not.toContain(
      createdB.body.data.evidence.id,
    );
    assertSafeEvidencePayload(listA.body);

    const filteredB = await request(app)
      .get("/api/v1/evidence")
      .query({ projectId: projectB.id })
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(filteredB.status).toBe(200);
    expect(filteredB.body).toEqual({ data: { evidence: [] }, meta: {} });

    const auditorList = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(auditorList.status).toBe(200);
    const auditorIds = auditorList.body.data.evidence.map((row: { id: string }) => row.id);
    expect(auditorIds).toEqual(
      expect.arrayContaining([
        createdA.body.data.evidence.id,
        createdB.body.data.evidence.id,
      ]),
    );
  });

  it("does not let a contractor bypass ownership by changing milestoneId", async () => {
    const owner = await registerAccount("CONTRACTOR", "Bypass Owner");
    const attacker = await registerAccount("CONTRACTOR", "Bypass Attacker");
    const project = await createProject(await contractorIdForUser(owner.userId), "Bypass Project");
    const milestone = await createMilestone(project.id, "Bypass Milestone");
    const created = await uploadFile(owner.token, {
      milestoneId: milestone.id,
      contents: Buffer.from("bypass-target"),
      filename: "target.txt",
    });
    expect(created.status).toBe(201);
    await trackEvidence(created.body.data.evidence.id);

    const listed = await request(app)
      .get("/api/v1/evidence")
      .query({ milestoneId: milestone.id })
      .set("Authorization", `Bearer ${attacker.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ data: { evidence: [] }, meta: {} });
  });
});
