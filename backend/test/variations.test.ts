import { randomUUID } from "crypto";
import { BlockchainEventType, Role, VerificationSource, VerificationStatus, VariationStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { setProofBlockchainWriterFactory, type ProofBlockchainWriter } from "../src/services/proof.service";
import {
  cleanupQaUsers,
  independentSha256,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./qa/fixtures";

const hash = independentSha256(Buffer.from("original-variation-evidence"));
const confirmedHash = `0x${"a".repeat(64)}`;

async function createBase() {
  const owner = await registerContractor("Variation Owner");
  const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
  const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("original-variation-evidence"), "original.txt");
  const evidenceId = upload.body.data.evidence.id as string;
  const versionId = upload.body.data.evidence.currentVersionId as string;
  const originalEvent = await prisma.blockchainEvent.create({
    data: {
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${versionId}`,
      referenceId: versionId,
      evidenceHash: hash,
      txHash: confirmedHash,
      blockNumber: 101,
    },
  });
  const verification = await prisma.verification.create({
    data: {
      evidenceVersionId: versionId,
      status: VerificationStatus.MATCH,
      presentedSha256: hash,
      authoritativeSha256: hash,
      source: VerificationSource.INTERNAL,
      requestedById: owner.userId,
    },
  });
  return { owner, project, milestone, evidenceId, versionId, originalEvent, verification };
}

function writer(recordVariation: ProofBlockchainWriter["recordVariation"]): ProofBlockchainWriter {
  return {
    isConfigured: () => true,
    canWrite: () => true,
    projectIsRegistered: async () => true,
    registerProject: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: "", eventId: randomUUID(), contractAddress: "0x" }),
    recordProof: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: hash, eventId: randomUUID(), contractAddress: "0x" }),
    recordAttestation: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: hash, eventId: randomUUID(), contractAddress: "0x" }),
    recordCorrection: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: hash, eventId: randomUUID(), contractAddress: "0x" }),
    recordDispute: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: "", eventId: randomUUID(), contractAddress: "0x" }),
    recordResolution: async () => ({ txHash: confirmedHash, blockNumber: 1, evidenceHash: "", eventId: randomUUID(), contractAddress: "0x" }),
    recordVariation,
  };
}

afterEach(async () => {
  setProofBlockchainWriterFactory(undefined);
  await cleanupQaUsers();
});
afterAll(async () => prisma.$disconnect());

describe("variation lifecycle", () => {
  it("requires authentication and validates create input", async () => {
    expect((await request(app).get("/api/v1/variations")).status).toBe(401);
    const owner = await registerContractor();
    expect((await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${owner.token}`).send({})).status).toBe(400);
    expect((await request(app).get(`/api/v1/variations/${randomUUID()}`).set("Authorization", `Bearer ${owner.token}`)).status).toBe(404);
  });

  it("creates an append-only variation with the original project and milestone snapshot", async () => {
    const base = await createBase();
    const response = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id,
      milestoneId: base.milestone.id,
      previousEventId: base.originalEvent.id,
      variationReference: "VO-001",
      reason: "approved scope adjustment requested",
      evidenceId: base.evidenceId,
      changes: { project: { name: "Revised project name" }, milestone: { name: "Revised milestone" } },
    });
    expect(response.status).toBe(201);
    expect(response.body.data.variation.status).toBe("OPEN");
    expect(response.body.data.variation.originalState.project.name).toBe(base.project.name);
    expect(response.body.data.variation.originalState.milestone.name).toBe(base.milestone.name);
    expect(response.body.data.variation.proposedState.project.name).toBe("Revised project name");
  });

  it("denies cross-contractor create/read and review/resolve before mutation", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-002", reason: "scope change", changes: { project: { description: "new scope" } },
    });
    const other = await registerContractor("Other contractor");
    const foreignCreate = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${other.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-X", reason: "unauthorized", changes: { project: { name: "stolen" } },
    });
    expect(foreignCreate.status).toBe(403);
    const id = created.body.data.variation.id as string;
    expect((await request(app).get(`/api/v1/variations/${id}`).set("Authorization", `Bearer ${other.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/variations/${id}/review`).set("Authorization", `Bearer ${other.token}`)).status).toBe(403);
    expect((await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${other.token}`).send({ status: "APPROVED", decision: "approve", note: "ok" })).status).toBe(403);
    const unchanged = await prisma.contractVariation.findUnique({ where: { id } });
    expect(unchanged?.status).toBe(VariationStatus.OPEN);
    expect((await request(app).get(`/api/v1/variations/${id}`).set("Authorization", `Bearer ${admin.token}`)).status).toBe(200);
  });

  it("applies approved changes while preserving original evidence, version, verification and proof in Passport history", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, milestoneId: base.milestone.id, previousEventId: base.originalEvent.id,
      variationReference: "VO-003", reason: "scope change", evidenceId: base.evidenceId,
      changes: { project: { name: "Current revised name" }, milestone: { description: "Revised deliverables" } },
    });
    const variationId = created.body.data.variation.id as string;
    expect((await request(app).post(`/api/v1/variations/${variationId}/review`).set("Authorization", `Bearer ${admin.token}`)).status).toBe(200);
    const resolved = await request(app).post(`/api/v1/variations/${variationId}/resolve`).set("Authorization", `Bearer ${admin.token}`).send({ status: "APPROVED", decision: "APPROVED", note: "contract change accepted" });
    expect(resolved.status).toBe(201);
    expect(resolved.body.data.variation.reviewedById).toBe(admin.userId);
    expect(resolved.body.data.variation.reviewedAt).toBeTruthy();
    const currentProject = await prisma.project.findUnique({ where: { id: base.project.id } });
    const currentMilestone = await prisma.milestone.findUnique({ where: { id: base.milestone.id } });
    expect(currentProject?.name).toBe("Current revised name");
    expect(currentMilestone?.description).toBe("Revised deliverables");
    const version = await prisma.evidenceVersion.findUnique({ where: { id: base.versionId } });
    const evidence = await prisma.evidence.findUnique({ where: { id: base.evidenceId } });
    const verification = await prisma.verification.findUnique({ where: { id: base.verification.id } });
    const event = await prisma.blockchainEvent.findUnique({ where: { id: base.originalEvent.id } });
    expect(version?.sha256).toBe(hash);
    expect(evidence?.sha256).toBe(hash);
    expect(verification?.status).toBe(VerificationStatus.MATCH);
    expect(event?.txHash).toBe(confirmedHash);
    const passport = await request(app).get(`/api/v1/passports/${base.project.id}`).set("Authorization", `Bearer ${base.owner.token}`);
    expect(passport.status).toBe(200);
    expect(passport.body.data.passport.project.name).toBe("Current revised name");
    expect(passport.body.data.passport.variations[0].originalState.project.name).toBe(base.project.name);
    expect(passport.body.data.passport.variations[0].status).toBe("APPROVED");
    expect(passport.body.data.passport.variations[0].review).not.toHaveProperty("reviewedById");
    expect(passport.body.data.passport.variations[0].resolutions[0]).not.toHaveProperty("resolvedById");
    expect(passport.body.data.passport.variations[0].resolutions[0].resolvedByRole).toBe("ADMIN");
  });

  it("rejects invalid references and conflicting resolutions", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    const unknownProject = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: randomUUID(), previousEventId: base.originalEvent.id, variationReference: "VO-UNKNOWN-PROJECT", reason: "x", changes: { project: { name: "x" } },
    });
    expect(unknownProject.status).toBe(404);
    const unknownEvent = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: randomUUID(), variationReference: "VO-UNKNOWN-EVENT", reason: "x", changes: { project: { name: "x" } },
    });
    expect(unknownEvent.status).toBe(404);
    const missing = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, milestoneId: randomUUID(), variationReference: "VO-004", reason: "x", changes: { milestone: { name: "new" } },
    });
    expect(missing.status).toBe(404);
    const unknownEvidence = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, evidenceId: randomUUID(), variationReference: "VO-UNKNOWN-EVIDENCE", reason: "x", changes: { project: { name: "x" } },
    });
    expect(unknownEvidence.status).toBe(404);
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-005", reason: "scope", changes: { project: { name: "another name" } },
    });
    const id = created.body.data.variation.id as string;
    const approved = await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send({ status: "APPROVED", decision: "approved", note: "accepted" });
    expect(approved.status).toBe(201);
    expect((await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send({ status: "REJECTED", decision: "rejected", note: "no" })).status).toBe(409);
    expect((await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-005", reason: "dup", changes: { project: { name: "dup" } },
    })).status).toBe(409);
  });

  it("records rejection without applying proposed project or milestone changes", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, milestoneId: base.milestone.id, previousEventId: base.originalEvent.id,
      variationReference: "VO-REJECTED", reason: "scope", changes: { project: { name: "Must not apply" }, milestone: { description: "Must not apply" } },
    });
    const id = created.body.data.variation.id as string;
    const response = await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send({ status: "REJECTED", decision: "REJECTED", note: "scope not accepted" });
    expect(response.status).toBe(201);
    expect(response.body.data.variation.status).toBe("REJECTED");
    expect((await prisma.project.findUnique({ where: { id: base.project.id } }))?.name).toBe(base.project.name);
    expect((await prisma.milestone.findUnique({ where: { id: base.milestone.id } }))?.description).toBeNull();
    expect(response.body.data.blockchainProof).toBeNull();
  });

  it("allows database variation history over an unconfirmed source without inventing a chain proof", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    await prisma.blockchainEvent.update({ where: { id: base.originalEvent.id }, data: { txHash: null, blockNumber: null } });
    let submitted = false;
    setProofBlockchainWriterFactory(() => writer(async () => { submitted = true; throw new Error("should not submit"); }));
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-UNCONFIRMED", reason: "scope", changes: { project: { description: "new" } },
    });
    expect(created.status).toBe(201);
    const id = created.body.data.variation.id as string;
    const resolved = await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send({ status: "APPROVED", decision: "accepted", note: "approved" });
    expect(resolved.status).toBe(201);
    expect(resolved.body.data.blockchainProof).toBeNull();
    expect(submitted).toBe(false);
    expect(await prisma.blockchainEvent.count({ where: { projectId: base.project.id, eventType: BlockchainEventType.VARIATION } })).toBe(0);
  });

  it("persists pending proof on blockchain failure and confirms it on an identical retry", async () => {
    const base = await createBase();
    const admin = await privileged(Role.ADMIN);
    const created = await request(app).post("/api/v1/variations").set("Authorization", `Bearer ${base.owner.token}`).send({
      projectId: base.project.id, previousEventId: base.originalEvent.id, variationReference: "VO-006", reason: "scope", changes: { project: { description: "new" } },
    });
    const id = created.body.data.variation.id as string;
    setProofBlockchainWriterFactory(() => writer(async () => { throw new Error("RPC unavailable"); }));
    const body = { status: "APPROVED", decision: "accepted", note: "go" };
    const failed = await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send(body);
    expect(failed.status).toBe(201);
    expect(failed.body.data.blockchainProof.confirmationState).toBe("PENDING");
    const eventId = failed.body.data.blockchainProof.id as string;
    expect((await prisma.blockchainEvent.findUnique({ where: { id: eventId } }))?.txHash).toBeNull();
    setProofBlockchainWriterFactory(() => writer(async (input) => ({ txHash: confirmedHash, blockNumber: 456, evidenceHash: "", eventId: input.eventId, contractAddress: "0x" })));
    const retried = await request(app).post(`/api/v1/variations/${id}/resolve`).set("Authorization", `Bearer ${admin.token}`).send(body);
    expect(retried.status).toBe(201);
    expect(retried.body.data.blockchainProof.confirmationState).toBe("CONFIRMED");
    expect(await prisma.blockchainEvent.count({ where: { projectId: base.project.id, eventType: BlockchainEventType.VARIATION } })).toBe(1);
  });
});
