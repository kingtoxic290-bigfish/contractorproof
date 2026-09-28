import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import { setProofBlockchainWriterFactory } from "../../src/services/proof.service";
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
  let recordProofCalls = 0;
  let recordAttestationCalls = 0;
  let failVerificationWrite = false;
  let failAttestationWrite = false;

  afterEach(async () => {
    setProofBlockchainWriterFactory();
    await cleanupQaUsers();
  });

  it("registers, authenticates, uploads, independently hashes, attests, MATCH-verifies, and public-verifies", async () => {
    recordProofCalls = 0;
    recordAttestationCalls = 0;
    failVerificationWrite = false;
    failAttestationWrite = false;
    setProofBlockchainWriterFactory(() => ({
      isConfigured: () => true,
      canWrite: () => true,
      projectIsRegistered: async () => true,
      registerProject: async () => ({ txHash: `0x${"11".repeat(32)}`, blockNumber: 1, evidenceHash: expectedHash, eventId: "project", contractAddress: "0x0000000000000000000000000000000000000001" }),
      recordProof: async (input) => {
        recordProofCalls += 1;
        if (failVerificationWrite) throw new Error("simulated RPC outage");
        return { txHash: `0x${"22".repeat(32)}`, blockNumber: 2, evidenceHash: input.evidenceHash, eventId: input.eventId, contractAddress: "0x0000000000000000000000000000000000000001" };
      },
      recordAttestation: async (input) => {
        recordAttestationCalls += 1;
        if (failAttestationWrite) throw new Error("simulated transaction rejection");
        return { txHash: `0x${"33".repeat(32)}`, blockNumber: 3, evidenceHash: input.evidenceHash, eventId: input.eventId, contractAddress: "0x0000000000000000000000000000000000000001" };
      },
    }));
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
    expect(postProject.status).toBe(201);
    expect(postProject.body.data.project.name).toBe("HTTP Project");
    expect(postProject.body.data.project.contractorId).toBe(contractor!.id);

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
    expect(recordAttestationCalls).toBe(0);

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
    expect(attestation.body.data.proof.txHash).toBe(`0x${"33".repeat(32)}`);
    assertNoSecrets(attestation.body);

    const duplicateAttestation = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: evidence.id, milestoneId: milestone.id, decision: "APPROVED" });
    expect(duplicateAttestation.status).toBe(409);
    expect(recordAttestationCalls).toBe(1);

    const attestRow = await prisma.attestation.findUnique({
      where: { id: attestation.body.data.attestation.id },
    });
    expect(attestRow?.verifierId).toBe(auditor.userId);
    expect(attestRow?.verifierId).not.toBe(userId);

    const eventsAfterAttest = await prisma.blockchainEvent.findMany({
      where: { projectId: project.id },
    });
    expect(eventsAfterAttest).toHaveLength(1);
    expect(eventsAfterAttest[0]?.eventType).toBe(BlockchainEventType.ATTESTATION);
    expect(eventsAfterAttest[0]?.txHash).toBe(`0x${"33".repeat(32)}`);

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
    expect(verify.body.data.proof.txHash).toBe(`0x${"22".repeat(32)}`);
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
    expect(eventsAfterMatch).toHaveLength(2);
    const verificationEvent = eventsAfterMatch.find((row) => row.eventType === BlockchainEventType.VERIFICATION);
    expect(verificationEvent?.referenceId).toBe(evidence.currentVersionId);
    expect(verificationEvent?.txHash).toBe(`0x${"22".repeat(32)}`);

    const repeatedMatch = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidence.id)
      .attach("file", originalBytes, "original.txt");
    expect(repeatedMatch.status).toBe(200);
    expect(repeatedMatch.body.data.proof.id).toBe(verificationEvent?.id);
    expect(recordProofCalls).toBe(1);
    expect(recordAttestationCalls).toBe(1);

    const tampered = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidence.id)
      .attach("file", Buffer.from("altered evidence bytes"), "tampered.txt");
    expect(tampered.status).toBe(200);
    expect(tampered.body.data.verification.status).toBe("MISMATCH");
    expect(tampered.body.data.proof).toBeNull();
    expect(recordProofCalls).toBe(1);

    const rpcFailureEvidence = await uploadEvidence(
      token,
      milestone.id,
      Buffer.from("bytes for RPC failure"),
      "rpc-failure.txt",
    );
    failVerificationWrite = true;
    const failedMatch = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", rpcFailureEvidence.body.data.evidence.id)
      .attach("file", Buffer.from("bytes for RPC failure"), "rpc-failure.txt");
    expect(failedMatch.status).toBe(502);
    failVerificationWrite = false;
    const pendingFailureEvent = await prisma.blockchainEvent.findFirst({
      where: { projectId: project.id, referenceId: rpcFailureEvidence.body.data.evidence.currentVersionId },
    });
    expect(pendingFailureEvent?.txHash).toBeNull();
    expect(pendingFailureEvent?.blockNumber).toBeNull();

    const rejectedEvidence = await uploadEvidence(
      token,
      milestone.id,
      Buffer.from("bytes for attestation failure"),
      "attestation-failure.txt",
    );
    failAttestationWrite = true;
    const failedAttestation = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: rejectedEvidence.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(failedAttestation.status).toBe(502);
    failAttestationWrite = false;
    expect(
      await prisma.attestation.count({ where: { evidenceId: rejectedEvidence.body.data.evidence.id } }),
    ).toBe(0);
    const pendingAttestationEvent = await prisma.blockchainEvent.findFirst({
      where: { projectId: project.id, eventType: BlockchainEventType.ATTESTATION, txHash: null },
    });
    expect(pendingAttestationEvent).not.toBeNull();

    const passport = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(passport.status).toBe(200);
    expect(passport.body.data.passport.project.id).toBe(project.id);
    expect(passport.body.data.passport.blockchainProofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ eventType: "VERIFICATION", confirmed: true }),
        expect.objectContaining({ eventType: "ATTESTATION", confirmed: true }),
      ]),
    );
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

  });
});
