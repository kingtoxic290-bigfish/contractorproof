import { BlockchainEventType } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { blockchainEventRepository } from "../src/repositories/blockchainEvent.repository";
import { prisma } from "../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./qa/fixtures";

describe("public verification proof projection", () => {
  afterEach(cleanupQaUsers);

  async function seededProof() {
    const owner = await registerContractor();
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("publicly verifiable fingerprint");
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "proof.txt");
    const version = upload.body.data.evidence.currentVersion;
    const event = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${version.id}`,
        referenceId: version.id,
        evidenceHash: version.sha256,
        txHash: `0x${"ab".repeat(32)}`,
        blockNumber: 42,
      },
    });
    return { owner, project, bytes, version, event };
  }

  it("returns MATCH and only safe confirmed proof details without authentication", async () => {
    const { bytes, version, event } = await seededProof();
    const response = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(response.status).toBe(200);
    expect(response.body.data.verification).toEqual({
      status: "MATCH",
      evidenceVersionId: version.id,
      meaning: expect.stringMatching(/confirmed verification proof/i),
      blockchainProof: {
        confirmed: true,
        transactionHash: event.txHash,
        blockNumber: 42,
      },
    });
    assertNoSecrets(response.body);
    expect(JSON.stringify(response.body)).not.toContain("storageReference");
  });

  it("returns MISMATCH only against the confirmed fingerprint", async () => {
    const { bytes, version } = await seededProof();
    const response = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", Buffer.from(`${bytes.toString()} changed`), "proof.txt");
    expect(response.status).toBe(200);
    expect(response.body.data.verification.status).toBe("MISMATCH");
    expect(response.body.data.verification.blockchainProof.confirmed).toBe(true);
  });

  it("distinguishes pending, missing, and inconsistent blockchain proofs", async () => {
    const { project, bytes, version, event } = await seededProof();
    const pending = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:pending-ref`,
        referenceId: "pending-ref",
        txHash: `0x${"de".repeat(32)}`,
      },
    });
    // Point the pending event at the test version using its stable reference.
    await prisma.blockchainEvent.update({ where: { id: pending.id }, data: { referenceId: version.id } });
    await prisma.blockchainEvent.delete({ where: { id: event.id } });

    const pendingResponse = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(pendingResponse.body.data.verification.status).toBe("PENDING");
    expect(pendingResponse.body.data.verification.blockchainProof).toEqual({ confirmed: false });

    await prisma.blockchainEvent.delete({ where: { id: pending.id } });
    const missingResponse = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(missingResponse.body.data.verification.status).toBe("UNAVAILABLE");

    await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${version.id}`,
        referenceId: version.id,
        evidenceHash: "ff".repeat(32),
        txHash: `0x${"cd".repeat(32)}`,
        blockNumber: 43,
      },
    });
    const inconsistent = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(inconsistent.body.data.verification.status).toBe("UNAVAILABLE");
    expect(inconsistent.body.data.verification.blockchainProof).toEqual({ confirmed: false });

    await prisma.blockchainEvent.update({
      where: {
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${version.id}`,
      },
      data: { evidenceHash: "not-a-sha256" },
    });
    const corrupt = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(corrupt.status).toBe(200);
    expect(corrupt.body.data.verification.status).toBe("UNAVAILABLE");
    expect(JSON.stringify(corrupt.body)).not.toMatch(/sha256 must|Prisma|database/i);

    const unknown = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "11111111-1111-4111-8111-111111111111")
      .attach("file", bytes, "proof.txt");
    expect(unknown.body.data.verification.status).toBe("UNAVAILABLE");
    expect(JSON.stringify(unknown.body)).not.toContain("projectId");
  });

  it("returns UNAVAILABLE for a wrong evidence pair and hides proof lookup failures", async () => {
    const { owner, bytes, version } = await seededProof();
    const wrongPair = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceId", "11111111-1111-4111-8111-111111111111")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(wrongPair.status).toBe(200);
    expect(wrongPair.body.data.verification.status).toBe("UNAVAILABLE");

    const proofLookup = vi
      .spyOn(blockchainEventRepository, "findVerificationProofByReference")
      .mockRejectedValueOnce(new Error("Prisma query failed at /private/database/path"));
    try {
      const failedRead = await request(app)
        .post("/api/v1/public/verify")
        .field("evidenceVersionId", version.id)
        .attach("file", bytes, "proof.txt");
      expect(failedRead.status).toBe(200);
      expect(failedRead.body.data.verification.status).toBe("UNAVAILABLE");
      expect(JSON.stringify(failedRead.body)).not.toMatch(/Prisma|database|private|storage|path/i);
      assertNoSecrets(failedRead.body, [owner.email]);
    } finally {
      proofLookup.mockRestore();
    }
  });

  it("rejects malformed/missing input safely while leaving private verification protected", async () => {
    const { bytes, version } = await seededProof();
    const malformed = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "not-a-uuid")
      .attach("file", bytes, "proof.txt");
    expect(malformed.status).toBe(400);
    assertNoSecrets(malformed.body);

    const missing = await request(app)
      .post("/api/v1/public/verify")
      .attach("file", bytes, "proof.txt");
    expect(missing.status).toBe(400);

    const privateResponse = await request(app)
      .post("/api/v1/verification")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(privateResponse.status).toBe(401);
  });

  it("does not allow project, contractor, or evidence ids to enumerate records", async () => {
    const { owner, project, bytes, version } = await seededProof();
    const guesses = [project.id, owner.contractorId, version.evidenceId];
    for (const guess of guesses) {
      const result = await request(app)
        .post("/api/v1/public/verify")
        .field("evidenceVersionId", guess)
        .attach("file", bytes, "proof.txt");
      expect(result.status).toBe(200);
      expect(result.body.data.verification.status).toBe("UNAVAILABLE");
      expect(JSON.stringify(result.body)).not.toContain(project.id);
      assertNoSecrets(result.body, [owner.email]);
    }
  });
});
