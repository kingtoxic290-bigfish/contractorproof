import { unlink } from "fs/promises";
import path from "path";
import { Role } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/repositories/prisma";
import { ATTEST_ERROR_CODES } from "../src/services/attestation.service";
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
const createdPolicyIds: string[] = [];

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
      fullName: `${role} Attestor`,
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

async function seedEvidence(owner: Account & { contractorId: string }, label: string, policyId?: string) {
  const project = await prisma.project.create({
    data: { contractorId: owner.contractorId, name: `${label} Project` },
  });
  createdProjectIds.push(project.id);
  const milestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      policyId: policyId ?? null,
      name: `${label} Milestone`,
    },
  });
  const upload = await request(app)
    .post("/api/v1/evidence")
    .set("Authorization", `Bearer ${owner.token}`)
    .field("milestoneId", milestone.id)
    .attach("file", Buffer.from(`${label}-bytes`), `${label}.txt`);
  expect(upload.status).toBe(201);
  createdEvidenceIds.push(upload.body.data.evidence.id);
  const row = await prisma.evidence.findUnique({
    where: { id: upload.body.data.evidence.id },
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
    evidenceId: upload.body.data.evidence.id as string,
    versionId: upload.body.data.evidence.currentVersionId as string,
  };
}

afterEach(async () => {
  const evidenceIds = createdEvidenceIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);
  const policyIds = createdPolicyIds.splice(0);
  const storageKeys = [...new Set(createdStorageKeys.splice(0))];

  if (evidenceIds.length > 0) {
    await prisma.attestation.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
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
  }
  if (policyIds.length > 0) {
    await prisma.verificationPolicy.deleteMany({ where: { id: { in: policyIds } } });
  }
  if (projectIds.length > 0) {
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

describe("POST /api/v1/attestations", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/attestations").send({
      evidenceId: "11111111-1111-4111-8111-111111111111",
      milestoneId: "11111111-1111-4111-8111-111111111112",
      decision: "APPROVED",
    });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", "Bearer not-a-valid-token")
      .send({
        evidenceId: "11111111-1111-4111-8111-111111111111",
        milestoneId: "11111111-1111-4111-8111-111111111112",
        decision: "APPROVED",
      });
    expect(response.status).toBe(401);
    expect(response.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
  });

  it("returns 400 when required fields are missing", async () => {
    const auditor = await privileged(Role.AUDITOR);
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ decision: "APPROVED" });
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed evidence UUID", async () => {
    const auditor = await privileged(Role.AUDITOR);
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: "not-a-uuid",
        milestoneId: "11111111-1111-4111-8111-111111111112",
        decision: "APPROVED",
      });
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid decision", async () => {
    const owner = await registerContractor("Invalid Decision Owner");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedEvidence(owner, "invalid-decision");
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "SAFE",
      });
    expect(response.status).toBe(400);
  });

  it("forbids CONTRACTOR from attesting their own evidence", async () => {
    const owner = await registerContractor("Self Attest Owner");
    const seeded = await seedEvidence(owner, "self");
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
        verifierRole: "AUDITOR",
      });
    expect(response.status).toBe(403);
    assertSafePayload(response.body);
  });

  it("forbids CONTRACTOR from attesting another contractor's evidence", async () => {
    const owner = await registerContractor("Target Owner");
    const other = await registerContractor("Other Contractor");
    const seeded = await seedEvidence(owner, "cross");
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
      });
    expect(response.status).toBe(403);
  });

  it("does not let changing evidenceId or evidenceVersionId bypass contractor denial", async () => {
    const ownerA = await registerContractor("Owner A");
    const ownerB = await registerContractor("Owner B");
    const seededA = await seedEvidence(ownerA, "a");
    const seededB = await seedEvidence(ownerB, "b");

    const own = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({
        evidenceId: seededA.evidenceId,
        milestoneId: seededA.milestone.id,
        decision: "APPROVED",
      });
    expect(own.status).toBe(403);

    const swapped = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({
        evidenceId: seededB.evidenceId,
        milestoneId: seededB.milestone.id,
        evidenceVersionId: seededB.versionId,
        decision: "APPROVED",
      });
    expect(swapped.status).toBe(403);
  });

  it("forbids a role without project access from attesting", async () => {
    const owner = await registerContractor("Client Target");
    const client = await registerClient("No Membership Client");
    const seeded = await seedEvidence(owner, "client-block");
    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
      });
    expect(response.status).toBe(403);
  });

  it("persists an APPROVED attestation for an authorized verifier", async () => {
    const owner = await registerContractor("Policy Owner");
    const auditor = await privileged(Role.AUDITOR);
    const project = await prisma.project.create({
      data: { contractorId: owner.contractorId, name: "Policy Project" },
    });
    createdProjectIds.push(project.id);
    const policy = await prisma.verificationPolicy.create({
      data: {
        projectId: project.id,
        name: "Auditor only",
        requiredApprovals: 1,
        allowedRoles: [Role.AUDITOR],
      },
    });
    createdPolicyIds.push(policy.id);
    const seeded = await seedEvidence(owner, "policy", policy.id);

    const officer = await privileged(Role.PROCUREMENT_OFFICER);
    const denied = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ATTEST_ERROR_CODES.ROLE_NOT_ALLOWED);

    const allowed = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
        comment: "site inspection accepted",
        verifierId: owner.userId,
        verifierRole: "ADMIN",
      });
    expect(allowed.status).toBe(201);
    expect(allowed.body).toMatchObject({
      data: {
        attestation: {
          evidenceId: seeded.evidenceId,
          milestoneId: seeded.milestone.id,
          decision: "APPROVED",
          verifierRole: "AUDITOR",
          comment: "site inspection accepted",
        },
      },
      meta: {},
    });
    expect(allowed.body.data.attestation.id).toEqual(expect.any(String));
    assertSafePayload(allowed.body);

    const row = await prisma.attestation.findUnique({
      where: { id: allowed.body.data.attestation.id },
    });
    expect(row).not.toBeNull();
    expect(row!.verifierId).toBe(auditor.userId);
    expect(row!.verifierId).not.toBe(owner.userId);
    expect(row!.verifierRole).toBe(Role.AUDITOR);
    expect(row!.decision).toBe("APPROVED");
    expect(row!.evidenceId).toBe(seeded.evidenceId);

    const evidence = await prisma.evidence.findUnique({ where: { id: seeded.evidenceId } });
    expect(evidence!.status).toBe("PENDING_VERIFICATION");
  });

  it("returns 409 when the same verifier attests the same evidence twice", async () => {
    const owner = await registerContractor("Dup Owner");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedEvidence(owner, "dup");

    const first = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "APPROVED",
      });
    expect(first.status).toBe(201);

    const second = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "REJECTED",
      });
    expect(second.status).toBe(409);
  });

  it("preserves REJECTED exactly and does not rewrite Evidence.status", async () => {
    const owner = await registerContractor("Reject Owner");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedEvidence(owner, "reject");

    const response = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: seeded.evidenceId,
        milestoneId: seeded.milestone.id,
        decision: "REJECTED",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.attestation.decision).toBe("REJECTED");
    expect(response.body.data.attestation.decision).not.toBe("MISMATCH");
    expect(response.body.data.attestation.decision).not.toBe("VERIFIED");

    const evidence = await prisma.evidence.findUnique({ where: { id: seeded.evidenceId } });
    expect(evidence!.status).toBe("PENDING_VERIFICATION");
  });
});

describe("GET /api/v1/attestations", () => {
  it("requires authentication", async () => {
    const response = await request(app).get("/api/v1/attestations");
    expect(response.status).toBe(401);
  });

  it("returns the standard envelope and excludes internal storage data for an authorized project reader", async () => {
    const owner = await registerContractor("Attestation List Owner");
    const auditor = await privileged(Role.AUDITOR);
    const { milestone, evidenceId } = await seedEvidence(owner, "Attestation List");
    const row = await prisma.attestation.create({
      data: {
        milestoneId: milestone.id,
        evidenceId,
        verifierId: auditor.userId,
        verifierRole: Role.AUDITOR,
        decision: "APPROVED",
        comment: "reviewed",
      },
    });

    const response = await request(app)
      .get(`/api/v1/attestations?projectId=${(await prisma.milestone.findUnique({ where: { id: milestone.id } }))!.projectId}`)
      .set("Authorization", `Bearer ${owner.token}`);

    expect(response.status).toBe(200);
    expect(response.body.data.attestations).toEqual([
      expect.objectContaining({ id: row.id, evidenceId, milestoneId: milestone.id }),
    ]);
    assertSafePayload(response.body);
  });
});
