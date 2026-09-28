import { randomUUID } from "crypto";
import request from "supertest";
import { BlockchainEventType, Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { localStorageService } from "../src/services/storage/LocalFilesystemStorageService";
import { EVIDENCE_MAX_FILE_BYTES } from "../src/services/evidence";
import { sha256Buffer } from "../src/utils/hash";
import { signAccessToken } from "../src/utils/jwt";

type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function assertNoLeakage(body: unknown, extra: string[] = []): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/stack/i);
  expect(serialized).not.toMatch(/prisma/i);
  expect(serialized).not.toMatch(/\bSQL\b/i);
  expect(serialized).not.toMatch(/storageKey/i);
  expect(serialized).not.toMatch(/storageReference/i);
  expect(serialized).not.toContain("/home/");
  expect(serialized).not.toContain("/var/");
  expect(serialized).not.toContain("/etc/");
  for (const value of extra) {
    expect(serialized).not.toContain(value);
  }
}

async function registerContractor(name = "Owner Contractor"): Promise<Account & { contractorId: string }> {
  const email = uniqueEmail("contractor");
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName: name,
    role: "CONTRACTOR",
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  const contractor = await prisma.contractor.findUnique({
    where: { userId: response.body.user.id },
  });
  if (!contractor) {
    throw new Error("expected contractor profile");
  }
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
    contractorId: contractor.id,
  };
}

async function registerClient(): Promise<Account> {
  const email = uniqueEmail("client");
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName: "Client User",
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

async function createPrivilegedUser(role: Role): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: "not-a-real-hash",
      fullName: `${role} User`,
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

async function seedOwnedMilestone(contractorId: string, name = "Foundation") {
  const project = await prisma.project.create({
    data: { contractorId, name: `${name} Project` },
  });
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, name },
  });
  return { project, milestone };
}

async function uploadEvidence(
  token: string,
  milestoneId: string,
  fileName: string,
  bytes: Buffer,
  extraFields: Record<string, string> = {},
) {
  const req = request(app)
    .post("/api/v1/evidence")
    .set("Authorization", `Bearer ${token}`)
    .field("milestoneId", milestoneId);
  for (const [key, value] of Object.entries(extraFields)) {
    req.field(key, value);
  }
  return req.attach("file", bytes, fileName);
}

async function cleanupUsers(): Promise<void> {
  const ids = [...createdUserIds];
  createdUserIds.length = 0;
  if (ids.length === 0) {
    return;
  }

  const evidence = await prisma.evidence.findMany({
    where: {
      OR: [{ uploadedById: { in: ids } }, { milestone: { project: { contractor: { userId: { in: ids } } } } }],
    },
    include: { versions: true },
  });
  const evidenceIds = evidence.map((row) => row.id);
  for (const row of evidence) {
    for (const version of row.versions) {
      await localStorageService.remove(version.storageReference);
    }
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

  await prisma.blockchainEvent.deleteMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });

  await prisma.milestone.deleteMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  await prisma.project.deleteMany({
    where: { contractor: { userId: { in: ids } } },
  });
  await prisma.contractor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

describe("Evidence and verification HTTP", () => {
  afterEach(async () => {
    await cleanupUsers();
  });

  it("creates version 1 for an authorized contractor and ignores client-supplied internals", async () => {
    const owner = await registerContractor();
    const { project, milestone } = await seedOwnedMilestone(owner.contractorId);
    const other = await registerContractor("Other Contractor");
    const bytes = Buffer.from("authorized-upload-bytes");

    const response = await uploadEvidence(owner.token, milestone.id, "site.jpg", bytes, {
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      storageKey: "/etc/passwd",
      storageReference: "/tmp/evil",
      currentVersionId: randomUUID(),
      uploadedById: other.userId,
      versionNumber: "99",
    });

    expect(response.status).toBe(201);
    expect(response.body.data.evidence.currentVersion.versionNumber).toBe(1);
    expect(response.body.data.evidence.sha256).toBe(sha256Buffer(bytes));
    expect(response.body.data.evidence.status).toBe("PENDING_VERIFICATION");
    expect(response.body.data.evidence.verificationStatus).toBe("PENDING");
    expect(response.body.meta).toEqual({});
    assertNoLeakage(response.body, [owner.email, other.email]);

    const row = await prisma.evidence.findUnique({ where: { id: response.body.data.evidence.id } });
    expect(row?.uploadedById).toBe(owner.userId);
    expect(row?.uploadedById).not.toBe(other.userId);
  });

  it("rejects unauthenticated, unauthorized, empty, oversized, and invalid files", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedOwnedMilestone(owner.contractorId);
    const client = await registerClient();
    const bytes = Buffer.from("valid-bytes");

    const unauthenticated = await request(app)
      .post("/api/v1/evidence")
      .field("milestoneId", milestone.id)
      .attach("file", bytes, "site.jpg");
    expect(unauthenticated.status).toBe(401);

    const unauthorized = await uploadEvidence(client.token, milestone.id, "site.jpg", bytes);
    expect(unauthorized.status).toBe(403);

    const missingMilestone = await uploadEvidence(owner.token, randomUUID(), "site.jpg", bytes);
    expect(missingMilestone.status).toBe(403);
    expect(missingMilestone.body.error.code).toBe("FORBIDDEN");

    const empty = await uploadEvidence(owner.token, milestone.id, "empty.jpg", Buffer.alloc(0));
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("FILE_EMPTY");

    const oversized = await uploadEvidence(
      owner.token,
      milestone.id,
      "big.jpg",
      Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1, 1),
    );
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe("FILE_TOO_LARGE");

    const invalidType = await uploadEvidence(
      owner.token,
      milestone.id,
      "payload.exe",
      Buffer.from("not-allowed"),
    );
    expect(invalidType.status).toBe(400);
    expect(invalidType.body.error.code).toBe("FILE_TYPE_NOT_ALLOWED");

    for (const response of [unauthenticated, unauthorized, missingMilestone, empty, oversized, invalidType]) {
      assertNoLeakage(response.body);
    }
  });

  it("scopes GET /api/v1/evidence in the query and does not leak another contractor's rows", async () => {
    const owner = await registerContractor();
    const stranger = await registerContractor("Stranger");
    const auditor = await createPrivilegedUser(Role.AUDITOR);
    const { project, milestone } = await seedOwnedMilestone(owner.contractorId);
    const created = await uploadEvidence(owner.token, milestone.id, "site.jpg", Buffer.from("idor-bytes"));
    const evidenceId = created.body.data.evidence.id as string;

    const ownerList = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownerList.status).toBe(200);
    expect(ownerList.body.data.evidence.map((row: { id: string }) => row.id)).toContain(evidenceId);
    assertNoLeakage(ownerList.body, [owner.email]);

    const strangerList = await request(app)
      .get("/api/v1/evidence")
      .query({ projectId: project.id })
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerList.status).toBe(200);
    expect(strangerList.body).toEqual({ data: { evidence: [] }, meta: {} });

    const auditorList = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(auditorList.status).toBe(200);
    expect(auditorList.body.data.evidence.map((row: { id: string }) => row.id)).toContain(evidenceId);
    assertNoLeakage(auditorList.body, [owner.email, stranger.email]);
  });

  it("records MATCH and MISMATCH without changing workflow status and ignores requestedById", async () => {
    const owner = await registerContractor();
    const other = await registerContractor("Other");
    const auditor = await createPrivilegedUser(Role.AUDITOR);
    const { milestone } = await seedOwnedMilestone(owner.contractorId);
    const bytes = Buffer.from("fingerprint-bytes");
    const created = await uploadEvidence(owner.token, milestone.id, "proof.jpg", bytes);
    const evidenceId = created.body.data.evidence.id as string;
    const versionId = created.body.data.evidence.currentVersionId as string;

    const match = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidenceId)
      .field("requestedById", other.userId)
      .attach("file", bytes, "proof.jpg");
    expect(match.status).toBe(200);
    expect(match.body.data.verification.status).toBe("MATCH");
    expect(match.body.data.verification.evidenceVersionId).toBe(versionId);
    expect(match.body.data.verification.sha256).toBe(sha256Buffer(bytes));
    expect(match.body.data.verification.source).toBe("INTERNAL");
    expect(match.body.data.verification.status).not.toBe("VERIFIED");

    const mismatch = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceVersionId", versionId)
      .attach("file", Buffer.from("fingerprint-bytes-tampered"), "proof.jpg");
    expect(mismatch.status).toBe(200);
    expect(mismatch.body.data.verification.status).toBe("MISMATCH");
    expect(mismatch.body.data.verification.status).not.toBe("REJECTED");
    expect(mismatch.body.data.verification.status).not.toBe("FAILED");

    const rows = await prisma.verification.findMany({
      where: { evidenceVersionId: versionId },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.requestedById).toBe(auditor.userId);
    expect(rows[0]?.requestedById).not.toBe(other.userId);
    expect(rows[0]?.source).toBe("INTERNAL");

    const evidence = await prisma.evidence.findUnique({ where: { id: evidenceId } });
    expect(evidence?.status).toBe("PENDING_VERIFICATION");
    assertNoLeakage(match.body, [other.email]);
  });

  it("returns UNAVAILABLE for public missing records and when stored bytes cannot be read", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedOwnedMilestone(owner.contractorId);
    const created = await uploadEvidence(
      owner.token,
      milestone.id,
      "gone.jpg",
      Buffer.from("stored-then-removed"),
    );
    const versionId = created.body.data.evidence.currentVersionId as string;
    const version = await prisma.evidenceVersion.findUnique({ where: { id: versionId } });
    await localStorageService.remove(version!.storageReference);

    const auditor = await createPrivilegedUser(Role.AUDITOR);
    const unavailable = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceVersionId: versionId });
    expect(unavailable.status).toBe(200);
    expect(unavailable.body.data.verification.status).toBe("UNAVAILABLE");

    const publicMissing = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", randomUUID())
      .attach("file", Buffer.from("anything"), "site.jpg");
    expect(publicMissing.status).toBe(200);
    expect(publicMissing.body.data.verification.status).toBe("UNAVAILABLE");
    assertNoLeakage(publicMissing.body);
  });

  it("performs public MATCH/MISMATCH without private fields", async () => {
    const owner = await registerContractor();
    const { project, milestone } = await seedOwnedMilestone(owner.contractorId);
    const bytes = Buffer.from("public-http-bytes");
    const created = await uploadEvidence(owner.token, milestone.id, "public.png", bytes);
    const versionId = created.body.data.evidence.currentVersionId as string;
    await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${versionId}`,
        referenceId: versionId,
        evidenceHash: created.body.data.evidence.sha256,
        txHash: `0x${"ef".repeat(32)}`,
        blockNumber: 7,
      },
    });

    const match = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", versionId)
      .field("requestedById", owner.userId)
      .field("email", owner.email)
      .attach("file", bytes, "public.png");
    expect(match.status).toBe(200);
    expect(match.body.data.verification.status).toBe("MATCH");
    expect(match.body.data.verification.meaning).toMatch(/does not prove/i);
    expect(match.body.data.verification).not.toHaveProperty("sha256");
    expect(match.body.data.verification).not.toHaveProperty("requestedById");
    assertNoLeakage(match.body, [owner.email]);

    const mismatch = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceId", created.body.data.evidence.id)
      .attach("file", Buffer.from("public-http-bytes-changed"), "public.png");
    expect(mismatch.status).toBe(200);
    expect(mismatch.body.data.verification.status).toBe("MISMATCH");
    assertNoLeakage(mismatch.body, [owner.email]);

    const publicRows = await prisma.verification.findMany({
      where: { evidenceVersionId: versionId, source: "PUBLIC" },
    });
    expect(publicRows.length).toBeGreaterThanOrEqual(2);
    expect(publicRows.every((row) => row.requestedById === null)).toBe(true);
  });

  it("does not let a stranger verify another contractor's evidence", async () => {
    const owner = await registerContractor();
    const stranger = await registerContractor("Stranger");
    const { milestone } = await seedOwnedMilestone(owner.contractorId);
    const created = await uploadEvidence(owner.token, milestone.id, "lock.jpg", Buffer.from("locked"));
    const forbidden = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${stranger.token}`)
      .field("evidenceId", created.body.data.evidence.id)
      .attach("file", Buffer.from("locked"), "lock.jpg");
    expect(forbidden.status).toBe(403);
    assertNoLeakage(forbidden.body, [owner.email, stranger.email]);
  });
});
