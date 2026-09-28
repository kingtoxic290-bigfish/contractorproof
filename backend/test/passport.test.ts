import { BlockchainEventType, Role, VerificationStatus } from "@prisma/client";
import { readFileSync } from "node:fs";
import path from "node:path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { evidenceService } from "../src/services/evidence";
import { setProofBlockchainWriterFactory } from "../src/services/proof.service";
import {
  assertNoSecrets,
  cleanupQaUsers,
  independentSha256,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./qa/fixtures";

function enableConfirmedTestWriter() {
  setProofBlockchainWriterFactory(() => ({
    isConfigured: () => true,
    canWrite: () => true,
    projectIsRegistered: async () => true,
    registerProject: async () => ({
      txHash: `0x${"11".repeat(32)}`,
      blockNumber: 1,
      evidenceHash: "",
      eventId: "project",
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
    recordProof: async (input) => ({
      txHash: `0x${"22".repeat(32)}`,
      blockNumber: 22,
      evidenceHash: input.evidenceHash,
      eventId: input.eventId,
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
    recordAttestation: async (input) => ({
      txHash: `0x${"33".repeat(32)}`,
      blockNumber: 33,
      evidenceHash: input.evidenceHash,
      eventId: input.eventId,
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
    recordCorrection: async (input) => ({
      txHash: `0x${"66".repeat(32)}`,
      blockNumber: 66,
      evidenceHash: input.evidenceHash,
      eventId: input.eventId,
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
    recordDispute: async (input) => ({
      txHash: `0x${"44".repeat(32)}`,
      blockNumber: 44,
      evidenceHash: "",
      eventId: input.eventId,
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
    recordResolution: async (input) => ({
      txHash: `0x${"55".repeat(32)}`,
      blockNumber: 55,
      evidenceHash: "",
      eventId: input.eventId,
      contractAddress: "0x0000000000000000000000000000000000000001",
    }),
  }));
}

afterEach(async () => {
  setProofBlockchainWriterFactory();
  await cleanupQaUsers();
});

describe("derived contractor passports", () => {
  it("requires no Passport database model", () => {
    const schema = readFileSync(path.resolve(__dirname, "../prisma/schema.prisma"), "utf8");
    expect(schema).not.toMatch(/^model Passport\s/m);
  });

  it("requires authentication for list and detail", async () => {
    const list = await request(app).get("/api/v1/passports");
    expect(list.status).toBe(401);
    expect(list.body.error).toMatchObject({ code: "UNAUTHENTICATED" });
    const detail = await request(app).get(
      "/api/v1/passports/11111111-1111-4111-8111-111111111111",
    );
    expect(detail.status).toBe(401);
    expect(detail.body.error).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("composes safe project history, all verification states, and confirmed and pending proofs", async () => {
    enableConfirmedTestWriter();
    const owner = await registerContractor("Passport Contractor");
    const auditor = await privileged(Role.AUDITOR, "Passport Auditor");
    const { project, policy, milestone } = await seedProjectWithPolicy(owner.contractorId, [
      Role.AUDITOR,
    ]);
    const original = Buffer.from("passport original evidence");
    const upload = await uploadEvidence(owner.token, milestone.id, original, "site-record.txt");
    const evidence = upload.body.data.evidence;

    const matched = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidence.id)
      .attach("file", original, "site-record.txt");
    expect(matched.status).toBe(200);
    expect(matched.body.data.verification.status).toBe("MATCH");

    const attested = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: evidence.id, milestoneId: milestone.id, decision: "APPROVED" });
    expect(attested.status).toBe(201);

    const tampered = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", evidence.id)
      .attach("file", Buffer.from("tampered passport evidence"), "site-record.txt");
    expect(tampered.body.data.verification.status).toBe("MISMATCH");

    const v2Bytes = Buffer.from("passport second version");
    await evidenceService.appendVersion({
      evidenceId: evidence.id,
      uploadedById: owner.userId,
      buffer: v2Bytes,
      originalName: "site-record-v2.txt",
      mimeType: "text/plain",
    });
    const v2 = await prisma.evidenceVersion.findFirst({
      where: { evidenceId: evidence.id, versionNumber: 2 },
    });
    expect(v2).not.toBeNull();
    for (const status of [VerificationStatus.PENDING, VerificationStatus.UNAVAILABLE]) {
      await prisma.verification.create({
        data: {
          evidenceVersionId: v2!.id,
          status,
          authoritativeSha256: v2!.sha256,
          source: "INTERNAL",
          requestedById: auditor.userId,
        },
      });
    }
    const pendingEvent = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `VERIFICATION:${project.id}:${v2!.id}:pending-test`,
        referenceId: v2!.id,
        evidenceHash: v2!.sha256,
      },
    });
    expect(pendingEvent.txHash).toBeNull();

    const response = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("data");
    expect(response.body).toHaveProperty("meta");
    const passport = response.body.data.passport;
    expect(passport.contractor).toMatchObject({
      id: owner.contractorId,
      legalName: "Passport Contractor",
    });
    expect(passport.project).toMatchObject({ id: project.id, name: project.name });
    expect(passport.milestones[0]).toMatchObject({
      id: milestone.id,
      status: "PENDING",
      policy: { id: policy.id },
    });

    const passportEvidence = passport.milestones[0].evidence[0];
    expect(passportEvidence.versions).toHaveLength(2);
    expect(passportEvidence.versions[0]).toMatchObject({
      id: evidence.currentVersionId,
      versionNumber: 1,
      sha256: independentSha256(original),
      verificationStatus: "MISMATCH",
      blockchainProof: expect.objectContaining({
        eventType: "VERIFICATION",
        confirmationState: "CONFIRMED",
        confirmed: true,
        txHash: `0x${"22".repeat(32)}`,
        blockNumber: 22,
      }),
    });
    expect(passportEvidence.versions[0].verifications.map((row: { status: string }) => row.status))
      .toEqual(["MATCH", "MISMATCH"]);
    expect(passportEvidence.versions[1]).toMatchObject({
      versionNumber: 2,
      sha256: independentSha256(v2Bytes),
      verificationStatus: "UNAVAILABLE",
      blockchainProof: expect.objectContaining({
        id: pendingEvent.id,
        confirmationState: "PENDING",
        confirmed: false,
        txHash: null,
        blockNumber: null,
      }),
    });
    expect(passportEvidence.versions[1].verifications.map((row: { status: string }) => row.status))
      .toEqual(["PENDING", "UNAVAILABLE"]);

    const passportAttestation = passportEvidence.attestations[0];
    expect(passportAttestation).toMatchObject({
      id: attested.body.data.attestation.id,
      decision: "APPROVED",
      verifierRole: "AUDITOR",
      policyId: policy.id,
      blockchainProof: {
        eventType: "ATTESTATION",
        confirmationState: "CONFIRMED",
        confirmed: true,
        txHash: `0x${"33".repeat(32)}`,
        blockNumber: 33,
      },
    });
    expect(passportEvidence).not.toHaveProperty("storageKey");
    expect(passportEvidence.versions[0]).not.toHaveProperty("storageReference");
    expect(passportAttestation).not.toHaveProperty("verifierId");
    expect(passportAttestation).not.toHaveProperty("comment");
    assertNoSecrets(response.body, [owner.email, auditor.email]);
  });

  it("scopes passport lists and detail reads to the existing project access model", async () => {
    const ownerA = await registerContractor("Passport Owner A");
    const ownerB = await registerContractor("Passport Owner B");
    const a = await seedProjectWithPolicy(ownerA.contractorId);
    const b = await seedProjectWithPolicy(ownerB.contractorId);

    const own = await request(app)
      .get(`/api/v1/passports/${a.project.id}`)
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(own.status).toBe(200);

    const other = await request(app)
      .get(`/api/v1/passports/${b.project.id}`)
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(other.status).toBe(403);
    expect(other.body.error).toMatchObject({ code: "FORBIDDEN" });

    const missing = await request(app)
      .get("/api/v1/passports/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(missing.status).toBe(404);

    const list = await request(app)
      .get("/api/v1/passports")
      .set("Authorization", `Bearer ${ownerA.token}`);
    expect(list.status).toBe(200);
    expect(list.body.data.passports.map((row: { project: { id: string } }) => row.project.id)).toEqual([
      a.project.id,
    ]);
  });

  it("returns an explicit empty/no-proof projection and empty list for roles without project access", async () => {
    const owner = await registerContractor("No Proof Owner");
    const client = await privileged(Role.CLIENT, "No Access Client");
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    await uploadEvidence(owner.token, milestone.id, Buffer.from("unverified"), "unverified.txt");

    const detail = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(detail.status).toBe(200);
    const evidence = detail.body.data.passport.milestones[0].evidence[0];
    expect(evidence.versions[0].verificationStatus).toBeNull();
    expect(evidence.versions[0].blockchainProof).toBeNull();
    expect(evidence.attestations).toEqual([]);
    expect(detail.body.data.passport.blockchainProofs).toEqual([]);

    const clientDetail = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientDetail.status).toBe(403);
    const clientList = await request(app)
      .get("/api/v1/passports")
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientList.status).toBe(200);
    expect(clientList.body.data.passports).toEqual([]);
  });
});
