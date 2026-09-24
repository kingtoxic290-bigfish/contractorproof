import { createHash } from "crypto";
import { Role } from "@prisma/client";
import request from "supertest";
import { expect } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import { localStorageService } from "../../src/services/storage/LocalFilesystemStorageService";
import { hashPassword } from "../../src/utils/password";
import { signAccessToken } from "../../src/utils/jwt";

export type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];

export function uniqueEmail(prefix: string): string {
  return `qa-${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

export function independentSha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertNoSecrets(body: unknown, extra: string[] = []): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/"password"\s*:/);
  expect(serialized).not.toMatch(/BLOCKCHAIN_PRIVATE_KEY/i);
  expect(serialized).not.toMatch(/JWT_SECRET/i);
  expect(serialized).not.toMatch(/storageKey/i);
  expect(serialized).not.toMatch(/storageReference/i);
  expect(serialized).not.toMatch(/trustScore|securityScore|complianceScore|safetyScore/i);
  expect(serialized).not.toMatch(/99\.8%|98% compliant|100% verified/i);
  expect(serialized).not.toContain("/home/");
  expect(serialized).not.toContain("/etc/passwd");
  for (const value of extra) {
    expect(serialized).not.toContain(value);
  }
}

export async function registerContractor(name = "QA Contractor"): Promise<Account & { contractorId: string }> {
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

export async function registerClient(name = "QA Client"): Promise<Account> {
  const email = uniqueEmail("client");
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName: name,
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

export async function privileged(role: Role, name?: string): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123"),
      fullName: name ?? `QA ${role}`,
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

export async function seedProjectWithPolicy(contractorId: string, allowedRoles: Role[] = [Role.AUDITOR]) {
  const project = await prisma.project.create({
    data: { contractorId, name: "QA Golden Project" },
  });
  const policy = await prisma.verificationPolicy.create({
    data: {
      projectId: project.id,
      name: "QA Auditor Policy",
      requiredApprovals: 1,
      allowedRoles,
    },
  });
  const milestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      policyId: policy.id,
      name: "QA Foundation",
    },
  });
  return { project, policy, milestone };
}

export async function uploadEvidence(token: string, milestoneId: string, bytes: Buffer, fileName = "original.jpg") {
  return request(app)
    .post("/api/v1/evidence")
    .set("Authorization", `Bearer ${token}`)
    .field("milestoneId", milestoneId)
    .attach("file", bytes, fileName);
}

export function trackUser(userId: string): void {
  createdUserIds.push(userId);
}

export async function cleanupQaUsers(): Promise<void> {
  const ids = [...createdUserIds].filter((id): id is string => Boolean(id));
  createdUserIds.length = 0;
  if (ids.length === 0) {
    return;
  }

  const evidence = await prisma.evidence.findMany({
    where: {
      OR: [
        { uploadedById: { in: ids } },
        { milestone: { project: { contractor: { userId: { in: ids } } } } },
      ],
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
    await prisma.attestation.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
    await prisma.correction.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  }

  await prisma.contractVariation.deleteMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  await prisma.dispute.deleteMany({
    where: { milestone: { project: { contractor: { userId: { in: ids } } } } },
  });
  await prisma.correction.deleteMany({
    where: { milestone: { project: { contractor: { userId: { in: ids } } } } },
  });
  await prisma.attestation.deleteMany({
    where: { milestone: { project: { contractor: { userId: { in: ids } } } } },
  });
  await prisma.blockchainEvent.deleteMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  await prisma.auditLog.deleteMany({ where: { userId: { in: ids } } });
  await prisma.milestone.deleteMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  const policies = await prisma.verificationPolicy.findMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  if (policies.length > 0) {
    await prisma.verificationPolicy.deleteMany({
      where: { id: { in: policies.map((row) => row.id) } },
    });
  }
  await prisma.project.deleteMany({ where: { contractor: { userId: { in: ids } } } });
  await prisma.contractor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}
