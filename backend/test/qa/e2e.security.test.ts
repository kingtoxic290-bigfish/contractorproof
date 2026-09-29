import jwt from "jsonwebtoken";
import request from "supertest";
import { Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/repositories/prisma";
import { ATTEST_ERROR_CODES, assertCanAttest } from "../../src/services/attestation.service";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
  seedProjectWithPolicy,
  uniqueEmail,
  uploadEvidence,
} from "./fixtures";

describe("E2E-003 / E2E-004 authentication, RBAC, IDOR, and impersonation", () => {
  afterEach(cleanupQaUsers);

  it("returns 401 without a token and for invalid or expired JWTs", async () => {
    const missing = await request(app).get("/api/v1/evidence");
    expect(missing.status).toBe(401);
    expect(missing.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "missing bearer token" });

    const invalid = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(invalid.status).toBe(401);
    expect(invalid.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });

    const expired = jwt.sign(
      {
        sub: "11111111-1111-4111-8111-111111111111",
        email: "x@example.com",
        role: "AUDITOR",
        exp: Math.floor(Date.now() / 1000) - 60,
      },
      env.jwtSecret,
    );
    const expiredResponse = await request(app)
      .get("/api/v1/evidence")
      .set("Authorization", `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.error).toMatchObject({ code: "UNAUTHENTICATED", message: "invalid or expired token" });
  });

  it("distinguishes 403 for authenticated users without permission", async () => {
    const client = await registerClient();
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const forbidden = await uploadEvidence(client.token, milestone.id, Buffer.from("nope"), "site.jpg");
    expect(forbidden.status).toBe(403);
    const code = forbidden.body.error?.code ?? forbidden.body.error;
    expect(["FORBIDDEN", "insufficient role"]).toContain(code);
    assertNoSecrets(forbidden.body);
  });

  it("rejects privileged public registration roles and does not create those accounts", async () => {
    for (const role of ["ADMIN", "AUDITOR", "PROCUREMENT_OFFICER", "CONSULTANT_ENGINEER"]) {
      const email = uniqueEmail(`priv-${role.toLowerCase()}`);
      const response = await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        fullName: "Attacker",
        role,
      });
      expect(response.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    }
  });

  it("does not let a body role elevate privileges on registration or provisioning", async () => {
    const contractor = await registerContractor();
    const forgedEmail = uniqueEmail("elevated");
    const elevated = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({
        email: forgedEmail,
        password: "password123",
        fullName: "Forged Admin",
        role: "ADMIN",
      });
    expect(elevated.status).toBe(403);
    expect(await prisma.user.findUnique({ where: { email: forgedEmail } })).toBeNull();

    const client = await registerClient();
    const asAdmin = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        email: uniqueEmail("client-admin"),
        password: "password123",
        fullName: "Client Admin",
        role: "ADMIN",
      });
    expect(asAdmin.status).toBe(403);
  });

  it("applies the RBAC matrix for evidence, verification, and attestation", async () => {
    const owner = await registerContractor();
    const client = await registerClient();
    const consultant = await privileged(Role.CONSULTANT_ENGINEER);
    const officer = await privileged(Role.PROCUREMENT_OFFICER);
    const auditor = await privileged(Role.AUDITOR);
    const admin = await privileged(Role.ADMIN);
    const { milestone } = await seedProjectWithPolicy(owner.contractorId, [Role.AUDITOR]);
    const bytes = Buffer.from("rbac-evidence");
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "rbac.txt");
    expect(upload.status).toBe(201);
    const evidenceId = upload.body.data.evidence.id as string;

    const verifyBy = async (token: string) =>
      request(app)
        .post("/api/v1/verification")
        .set("Authorization", `Bearer ${token}`)
        .send({ evidenceId });

    const attestBy = async (token: string) =>
      request(app)
        .post("/api/v1/attestations")
        .set("Authorization", `Bearer ${token}`)
        .send({ evidenceId, milestoneId: milestone.id, decision: "APPROVED" });

    expect((await verifyBy(owner.token)).status).toBe(403);
    expect((await attestBy(owner.token)).status).toBe(403);

    expect((await verifyBy(client.token)).status).toBe(403);
    expect((await attestBy(client.token)).status).toBe(403);

    expect((await verifyBy(consultant.token)).status).toBe(403);
    expect((await attestBy(consultant.token)).status).toBe(403);

    const officerVerify = await verifyBy(officer.token);
    expect(officerVerify.status).toBe(200);
    expect(officerVerify.body.data.verification.status).toBe("MATCH");

    const officerAttest = await attestBy(officer.token);
    expect(officerAttest.status).toBe(403);
    expect(officerAttest.body.error.code).toBe(ATTEST_ERROR_CODES.ROLE_NOT_ALLOWED);

    const auditorVerify = await verifyBy(auditor.token);
    expect(auditorVerify.status).toBe(200);
    expect(auditorVerify.body.data.verification.status).toBe("MATCH");

    const auditorAttest = await attestBy(auditor.token);
    expect(auditorAttest.status).toBe(201);

    const adminUpload = await uploadEvidence(admin.token, milestone.id, Buffer.from("admin-bytes"), "admin.txt");
    expect(adminUpload.status).toBe(201);
    const adminSelf = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        evidenceId: adminUpload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(adminSelf.status).toBe(403);
    expect(adminSelf.body.error.code).toBe(ATTEST_ERROR_CODES.UPLOADER_ATTEST_FORBIDDEN);

    try {
      assertCanAttest({
        actor: {
          id: owner.userId,
          email: owner.email,
          fullName: "Owner",
          role: Role.AUDITOR,
        },
        evidenceUploaderId: admin.userId,
        contractorUserId: owner.userId,
        allowedRoles: [Role.AUDITOR],
      });
      expect.unreachable("owner must not attest");
    } catch (error) {
      expect(error).toMatchObject({
        statusCode: 403,
        code: ATTEST_ERROR_CODES.OWNER_ATTEST_FORBIDDEN,
      });
    }
  });

  it("blocks User B from using User A's private evidence, verification, and attestation", async () => {
    const ownerA = await registerContractor("Owner A");
    const ownerB = await registerContractor("Owner B");
    const { project, milestone } = await seedProjectWithPolicy(ownerA.contractorId);
    const upload = await uploadEvidence(ownerA.token, milestone.id, Buffer.from("private-a"), "a.txt");
    const evidenceId = upload.body.data.evidence.id as string;
    const versionId = upload.body.data.evidence.currentVersionId as string;

    const listB = await request(app)
      .get("/api/v1/evidence")
      .query({ projectId: project.id })
      .set("Authorization", `Bearer ${ownerB.token}`);
    expect(listB.status).toBe(200);
    expect(listB.body.data.evidence).toEqual([]);

    const verifyB = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${ownerB.token}`)
      .send({ evidenceId, evidenceVersionId: versionId });
    expect(verifyB.status).toBe(403);

    const attestB = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${ownerB.token}`)
      .send({
        evidenceId,
        milestoneId: milestone.id,
        decision: "APPROVED",
        userId: ownerA.userId,
        verifierId: ownerA.userId,
      });
    expect(attestB.status).toBe(403);

    const fileB = await request(app)
      .get(`/api/v1/evidence/${evidenceId}/file`)
      .set("Authorization", `Bearer ${ownerB.token}`);
    expect([401, 403, 404]).toContain(fileB.status);
    expect(fileB.status).not.toBe(200);
  });

  it("does not trust body userId or role when creating evidence or attesting", async () => {
    const owner = await registerContractor();
    const stranger = await registerContractor("Stranger");
    const auditor = await privileged(Role.AUDITOR);
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("owned"), "owned.txt");

    const swapped = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", milestone.id)
      .field("uploadedById", stranger.userId)
      .field("userId", stranger.userId)
      .field("role", "ADMIN")
      .attach("file", Buffer.from("still-owner"), "owned2.txt");
    expect(swapped.status).toBe(201);
    expect(swapped.body.data.evidence).toBeDefined();
    const row = await prisma.evidence.findUnique({
      where: { id: swapped.body.data.evidence.id },
    });
    expect(row?.uploadedById).toBe(owner.userId);
    expect(row?.uploadedById).not.toBe(stranger.userId);

    const attest = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
        verifierId: stranger.userId,
        verifierRole: "ADMIN",
        userId: stranger.userId,
        role: "ADMIN",
      });
    expect(attest.status).toBe(201);
    expect(attest.body.data.attestation.verifierRole).toBe("AUDITOR");
    const attestation = await prisma.attestation.findUnique({
      where: { id: attest.body.data.attestation.id },
    });
    expect(attestation?.verifierId).toBe(auditor.userId);
    expect(attestation?.verifierRole).toBe(Role.AUDITOR);
  });
});
