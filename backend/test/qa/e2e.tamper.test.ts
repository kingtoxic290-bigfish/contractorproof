import request from "supertest";
import { BlockchainEventType, Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  independentSha256,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

describe("E2E-002 tamper detection", () => {
  afterEach(cleanupQaUsers);

  it("returns MISMATCH when modified bytes are compared to the original fingerprint", async () => {
    const originalBytes = Buffer.from("original.txt-canonical-contents");
    const modifiedBytes = Buffer.from("modified.txt-tampered-contents");
    const hashA = independentSha256(originalBytes);
    const hashB = independentSha256(modifiedBytes);
    expect(hashA).not.toBe(hashB);

    const owner = await registerContractor("Tamper Owner");
    const auditor = await privileged(Role.AUDITOR);
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);

    const upload = await uploadEvidence(owner.token, milestone.id, originalBytes, "original.txt");
    expect(upload.status).toBe(201);
    expect(upload.body.data.evidence.sha256).toBe(hashA);
    expect(upload.body.data.evidence.sha256).not.toBe(hashB);
    await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${upload.body.data.evidence.currentVersionId}`,
        referenceId: upload.body.data.evidence.currentVersionId,
        evidenceHash: hashA,
        txHash: `0x${"ef".repeat(32)}`,
        blockNumber: 14,
      },
    });

    const match = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", upload.body.data.evidence.id)
      .attach("file", originalBytes, "original.txt");
    expect(match.status).toBe(200);
    expect(match.body.data.verification.status).toBe("MATCH");
    expect(match.body.data.verification.sha256).toBe(hashA);

    const tamper = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .field("evidenceId", upload.body.data.evidence.id)
      .attach("file", modifiedBytes, "modified.txt");
    expect(tamper.status).toBe(200);
    expect(tamper.body.data.verification.status).toBe("MISMATCH");
    expect(tamper.body.data.verification.status).not.toBe("MATCH");
    expect(tamper.body.data.verification.status).not.toBe("VERIFIED");
    expect(tamper.body.data.verification.status).not.toBe("REJECTED");
    expect(tamper.body.data.verification.sha256).toBe(hashA);
    expect(tamper.body.data.verification.sha256).not.toBe(hashB);
    const persisted = await prisma.verification.findUnique({
      where: { id: tamper.body.data.verification.id },
    });
    expect(persisted?.status).toBe("MISMATCH");
    expect(persisted?.presentedSha256).toBe(hashB);
    expect(persisted?.authoritativeSha256).toBe(hashA);
    assertNoSecrets(tamper.body);

    const publicTamper = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", upload.body.data.evidence.currentVersionId)
      .attach("file", modifiedBytes, "modified.txt");
    expect(publicTamper.status).toBe(200);
    expect(publicTamper.body.data.verification.status).toBe("MISMATCH");
    expect(publicTamper.body.data.verification.status).not.toBe("MATCH");
    expect(publicTamper.body.data.verification.meaning).toMatch(/does not match/i);
    assertNoSecrets(publicTamper.body);
  });
});
