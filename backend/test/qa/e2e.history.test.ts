import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import { evidenceService } from "../../src/services/evidence";
import {
  assertNoSecrets,
  cleanupQaUsers,
  independentSha256,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

describe("evidence versions, disputes, corrections, and variations", () => {
  afterEach(cleanupQaUsers);

  it("preserves historical SHA-256 when a new version is appended", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytesA = Buffer.from("version-a-bytes");
    const bytesB = Buffer.from("version-b-bytes");
    const hashA = independentSha256(bytesA);
    const hashB = independentSha256(bytesB);

    const created = await uploadEvidence(owner.token, milestone.id, bytesA, "a.txt");
    const evidenceId = created.body.data.evidence.id as string;
    const versionAId = created.body.data.evidence.currentVersionId as string;

    const appended = await evidenceService.appendVersion({
      evidenceId,
      uploadedById: owner.userId,
      buffer: bytesB,
      originalName: "b.txt",
      mimeType: "text/plain",
    });
    expect(appended.sha256).toBe(hashB);
    expect(appended.currentVersion?.versionNumber).toBe(2);
    expect(appended.currentVersion?.sha256).toBe(hashB);

    const versionA = await prisma.evidenceVersion.findUnique({ where: { id: versionAId } });
    expect(versionA?.sha256).toBe(hashA);
    expect(versionA?.versionNumber).toBe(1);

    const versions = await prisma.evidenceVersion.findMany({
      where: { evidenceId },
      orderBy: { versionNumber: "asc" },
    });
    expect(versions).toHaveLength(2);
    expect(versions[0]?.sha256).toBe(hashA);
    expect(versions[1]?.sha256).toBe(hashB);
  });

  it("creates disputes without erasing original evidence or inventing a proof event", async () => {
    const owner = await registerContractor();
    const auditor = await privileged(Role.AUDITOR);
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("dispute-original");
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "dispute.txt");
    const originalHash = upload.body.data.evidence.sha256 as string;

    const created = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: milestone.id,
        reason: "site measurement is contested",
        status: "RESOLVED",
        evidenceId: upload.body.data.evidence.id,
      });
    expect(created.status).toBe(201);
    expect(created.body.data.dispute.status).toBe("OPEN");
    expect(created.body.data.dispute.evidenceId).toBe(upload.body.data.evidence.id);
    assertNoSecrets(created.body);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .query({ projectId: project.id })
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.disputes).toHaveLength(1);

    const evidence = await prisma.evidence.findUnique({
      where: { id: upload.body.data.evidence.id },
    });
    expect(evidence?.sha256).toBe(originalHash);
    expect(await prisma.blockchainEvent.count({ where: { projectId: project.id } })).toBe(0);
  });

  it("creates a correction as a new row and does not rewrite the original event or hash", async () => {
    const owner = await registerContractor();
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("correct-me"), "c.txt");
    const originalEvent = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${upload.body.data.evidence.currentVersionId}`,
        referenceId: upload.body.data.evidence.currentVersionId,
        evidenceHash: upload.body.data.evidence.sha256,
        actorId: owner.userId,
      },
    });

    const correction = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: milestone.id,
        originalEventId: originalEvent.id,
        reason: "filename typo in metadata",
        evidenceId: upload.body.data.evidence.id,
      });
    expect(correction.status).toBe(201);
    expect(correction.body.data.correction.originalEventId).toBe(originalEvent.id);
    expect(correction.body.data.correction.id).not.toBe(originalEvent.id);
    assertNoSecrets(correction.body);

    const unchanged = await prisma.blockchainEvent.findUnique({ where: { id: originalEvent.id } });
    expect(unchanged?.evidenceHash).toBe(upload.body.data.evidence.sha256);
    expect(unchanged?.txHash).toBeNull();

    const version = await prisma.evidenceVersion.findUnique({
      where: { id: upload.body.data.evidence.currentVersionId },
    });
    expect(version?.sha256).toBe(upload.body.data.evidence.sha256);
  });

  it("keeps variations unimplemented rather than overwriting history", async () => {
    const owner = await registerContractor();
    const get = await request(app)
      .get("/api/v1/variations")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(get.status).toBe(501);
    const post = await request(app)
      .post("/api/v1/variations")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ reason: "scope change" });
    expect(post.status).toBe(501);
  });
});
