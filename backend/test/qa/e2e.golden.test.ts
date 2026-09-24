import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  independentSha256,
  privileged,
  seedProjectWithPolicy,
  trackUser,
  uploadEvidence,
} from "./fixtures";

describe("E2E-001 golden ContractorProof lifecycle (implemented slice)", () => {
  afterEach(cleanupQaUsers);

  it("registers, authenticates, uploads, independently hashes, attests, MATCH-verifies, and public-verifies", async () => {
    const started = Date.now();
    const originalBytes = Buffer.from("contractorproof-golden-original-evidence");
    const expectedHash = independentSha256(originalBytes);

    const registered = await request(app).post("/api/v1/auth/register").send({
      email: `qa-golden-${Date.now()}@example.com`,
      password: "password123",
      fullName: "Golden Contractor",
      role: "CONTRACTOR",
    });
    expect(registered.status).toBe(201);
    expect(registered.body.user.role).toBe("CONTRACTOR");
    expect(registered.body.token).toEqual(expect.any(String));
    expect(registered.body.user).not.toHaveProperty("passwordHash");
    expect(registered.body.user).not.toHaveProperty("password");
    assertNoSecrets(registered.body);

    const userId = registered.body.user.id as string;
    trackUser(userId);

    const stored = await prisma.user.findUnique({ where: { id: userId } });
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toContain("password123");

    const login = await request(app).post("/api/v1/auth/login").send({
      email: registered.body.user.email,
      password: "password123",
    });
    expect(login.status).toBe(200);
    expect(login.body.token).toEqual(expect.any(String));
    const token = login.body.token as string;

    const contractor = await prisma.contractor.findUnique({ where: { userId } });
    expect(contractor).not.toBeNull();
    expect(contractor!.userId).toBe(userId);

    const { project, policy, milestone } = await seedProjectWithPolicy(contractor!.id, [Role.AUDITOR]);
    expect(milestone.projectId).toBe(project.id);
    expect(milestone.policyId).toBe(policy.id);
    expect(policy.allowedRoles).toEqual([Role.AUDITOR]);

    const postProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "HTTP Project" });
    expect([404, 405]).toContain(postProject.status);

    const upload = await uploadEvidence(token, milestone.id, originalBytes, "original.txt");
    expect(upload.status).toBe(201);
    const evidence = upload.body.data.evidence;
    expect(evidence.status).toBe("PENDING_VERIFICATION");
    expect(evidence.verificationStatus).toBe("PENDING");
    expect(evidence.sha256).toBe(expectedHash);
    expect(evidence.currentVersion.versionNumber).toBe(1);
    expect(evidence.currentVersion.sha256).toBe(expectedHash);
    assertNoSecrets(upload.body);

    const version = await prisma.evidenceVersion.findUnique({
      where: { id: evidence.currentVersionId },
    });
    expect(version?.sha256).toBe(expectedHash);
    expect(version?.sha256).toBe(independentSha256(originalBytes));

    const auditor = await privileged(Role.AUDITOR, "Golden Auditor");
    const contractorAttest = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${token}`)
      .send({
        evidenceId: evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
        verifierRole: "AUDITOR",
      });
    expect(contractorAttest.status).toBe(403);

    const attestation = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
        comment: "authorized site review",
        verifierId: userId,
        verifierRole: "ADMIN",
      });
    expect(attestation.status).toBe(201);
    expect(attestation.body.data.attestation.decision).toBe("APPROVED");
    expect(attestation.body.data.attestation.verifierRole).toBe("AUDITOR");
    assertNoSecrets(attestation.body);

    const attestRow = await prisma.attestation.findUnique({
      where: { id: attestation.body.data.attestation.id },
    });
    expect(attestRow?.verifierId).toBe(auditor.userId);
    expect(attestRow?.verifierId).not.toBe(userId);

    const eventsAfterAttest = await prisma.blockchainEvent.findMany({
      where: { projectId: project.id },
    });
    expect(eventsAfterAttest).toHaveLength(0);

    const beforeVerifyAttestations = await prisma.attestation.count({
      where: { evidenceId: evidence.id },
    });

    const verify = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidence.id)
      .attach("file", originalBytes, "original.txt");
    expect(verify.status).toBe(200);
    expect(verify.body.data.verification.status).toBe("MATCH");
    expect(verify.body.data.verification.status).not.toBe("VERIFIED");
    expect(verify.body.data.verification.sha256).toBe(expectedHash);
    expect(verify.body.data.verification.meaning).toBeUndefined();
    assertNoSecrets(verify.body);

    const afterVerifyAttestations = await prisma.attestation.count({
      where: { evidenceId: evidence.id },
    });
    expect(afterVerifyAttestations).toBe(beforeVerifyAttestations);

    const evidenceAfterMatch = await prisma.evidence.findUnique({ where: { id: evidence.id } });
    expect(evidenceAfterMatch?.status).toBe("PENDING_VERIFICATION");

    const eventsAfterMatch = await prisma.blockchainEvent.findMany({
      where: { projectId: project.id },
    });
    expect(eventsAfterMatch).toHaveLength(0);
    expect(eventsAfterMatch.every((row) => row.eventType !== BlockchainEventType.VERIFICATION)).toBe(
      true,
    );

    const passport = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(passport.status).toBe(501);
    expect(passport.body.resource).toBe("passports");
    assertNoSecrets(passport.body);

    const publicVerify = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", evidence.currentVersionId)
      .attach("file", originalBytes, "original.txt");
    expect(publicVerify.status).toBe(200);
    expect(publicVerify.body.data.verification.status).toBe("MATCH");
    expect(publicVerify.body.data.verification.meaning).toMatch(/does not mean/i);
    expect(publicVerify.body.data.verification).not.toHaveProperty("sha256");
    expect(publicVerify.body.data.verification).not.toHaveProperty("requestedById");
    expect(publicVerify.body.data.verification).not.toHaveProperty("email");
    assertNoSecrets(publicVerify.body, [registered.body.user.email, token]);

    expect(Date.now() - started).toBeLessThan(30_000);
  });
});
