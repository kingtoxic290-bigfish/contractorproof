import request from "supertest";
import { Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { localStorageService } from "../src/services/storage/LocalFilesystemStorageService";
import { hashPassword } from "../src/utils/password";
import { signAccessToken } from "../src/utils/jwt";
import { ATTEST_ERROR_CODES } from "../src/services/attestation.service";

const createdUserIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

async function registerContractor() {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("contractor"),
    password: "password123",
    fullName: "Attest Contractor",
    role: "CONTRACTOR",
  });
  createdUserIds.push(response.body.user.id);
  const contractor = await prisma.contractor.findUnique({
    where: { userId: response.body.user.id },
  });
  return { token: response.body.token as string, userId: response.body.user.id as string, contractorId: contractor!.id };
}

async function privileged(role: Role) {
  const user = await prisma.user.create({
    data: {
      email: uniqueEmail(role.toLowerCase()),
      passwordHash: await hashPassword("password123"),
      fullName: `${role} Attestor`,
      role,
    },
  });
  createdUserIds.push(user.id);
  return {
    token: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    userId: user.id,
  };
}

async function cleanup(): Promise<void> {
  const ids = [...createdUserIds];
  createdUserIds.length = 0;
  if (ids.length === 0) {
    return;
  }
  const evidence = await prisma.evidence.findMany({
    where: { milestone: { project: { contractor: { userId: { in: ids } } } } },
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
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  }
  await prisma.milestone.deleteMany({ where: { project: { contractor: { userId: { in: ids } } } } });
  const policies = await prisma.verificationPolicy.findMany({
    where: { project: { contractor: { userId: { in: ids } } } },
  });
  await prisma.verificationPolicy.deleteMany({
    where: { id: { in: policies.map((row) => row.id) } },
  });
  await prisma.project.deleteMany({ where: { contractor: { userId: { in: ids } } } });
  await prisma.contractor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

describe("attestation authorization", () => {
  afterEach(cleanup);

  it("rejects contractor self-attestation and unauthorized roles", async () => {
    const owner = await registerContractor();
    const project = await prisma.project.create({
      data: { contractorId: owner.contractorId, name: "Attest Project" },
    });
    const milestone = await prisma.milestone.create({
      data: { projectId: project.id, name: "Attest Milestone" },
    });
    const upload = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", milestone.id)
      .attach("file", Buffer.from("attest-bytes"), "site.jpg");
    expect(upload.status).toBe(201);

    const self = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(self.status).toBe(403);

    const unauthenticated = await request(app).post("/api/v1/attestations").send({
      evidenceId: upload.body.data.evidence.id,
      milestoneId: milestone.id,
      decision: "APPROVED",
    });
    expect(unauthenticated.status).toBe(401);
  });

  it("allows an authorized privileged attestor when policy permits", async () => {
    const owner = await registerContractor();
    const auditor = await privileged(Role.AUDITOR);
    const project = await prisma.project.create({
      data: { contractorId: owner.contractorId, name: "Policy Project" },
    });
    const policy = await prisma.verificationPolicy.create({
      data: {
        projectId: project.id,
        name: "Auditor only",
        requiredApprovals: 1,
        allowedRoles: [Role.AUDITOR],
      },
    });
    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        policyId: policy.id,
        name: "Policy Milestone",
      },
    });
    const upload = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", milestone.id)
      .attach("file", Buffer.from("policy-bytes"), "site.jpg");

    const officer = await privileged(Role.PROCUREMENT_OFFICER);
    const denied = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${officer.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe(ATTEST_ERROR_CODES.ROLE_NOT_ALLOWED);

    const allowed = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(allowed.status).toBe(201);
    expect(allowed.body.data.attestation.decision).toBe("APPROVED");

    const evidence = await prisma.evidence.findUnique({
      where: { id: upload.body.data.evidence.id },
    });
    expect(evidence?.status).toBe("PENDING_VERIFICATION");
  });
});
