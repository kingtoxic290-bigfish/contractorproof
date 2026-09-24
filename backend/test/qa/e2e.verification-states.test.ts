import { unlink } from "fs/promises";
import path from "path";
import request from "supertest";
import { Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

describe("verification states MATCH / MISMATCH / PENDING / UNAVAILABLE", () => {
  afterEach(cleanupQaUsers);

  it("does not invent MATCH for unknown evidence; privileged HTTP is 404 and public compare is UNAVAILABLE", async () => {
    const auditor = await privileged(Role.AUDITOR);
    const unknown = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: "11111111-1111-4111-8111-111111111111" });
    expect(unknown.status).toBe(404);
    expect(unknown.body.error.code).toBe("EVIDENCE_NOT_FOUND");
    expect(JSON.stringify(unknown.body)).not.toMatch(/MATCH/);
    assertNoSecrets(unknown.body);

    const publicUnknown = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "11111111-1111-4111-8111-111111111111")
      .attach("file", Buffer.from("unknown-bytes"), "u.txt");
    expect(publicUnknown.status).toBe(200);
    expect(publicUnknown.body.data.verification.status).toBe("UNAVAILABLE");
    expect(publicUnknown.body.data.verification.status).not.toBe("MATCH");
    assertNoSecrets(publicUnknown.body);
  });

  it("keeps verificationStatus PENDING until compare and cannot persist an empty SHA-256", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("pending-bytes"), "p.txt");
    expect(upload.status).toBe(201);
    expect(upload.body.data.evidence.verificationStatus).toBe("PENDING");
    expect(upload.body.data.evidence.status).toBe("PENDING_VERIFICATION");
    expect(await prisma.attestation.count({ where: { evidenceId: upload.body.data.evidence.id } })).toBe(
      0,
    );
    expect(
      await prisma.blockchainEvent.count({
        where: { project: { milestones: { some: { id: milestone.id } } } },
      }),
    ).toBe(0);

    await expect(
      prisma.evidenceVersion.update({
        where: { id: upload.body.data.evidence.currentVersionId },
        data: { sha256: "" },
      }),
    ).rejects.toThrow(/EvidenceVersion_sha256_hex_chk|sha256/i);
  });

  it("returns UNAVAILABLE when stored bytes cannot be read", async () => {
    const owner = await registerContractor();
    const auditor = await privileged(Role.AUDITOR);
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("missing-file"), "m.txt");
    const version = await prisma.evidenceVersion.findUnique({
      where: { id: upload.body.data.evidence.currentVersionId },
    });
    expect(version).not.toBeNull();
    await unlink(path.join(env.storagePath, version!.storageReference));

    const unavailable = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: upload.body.data.evidence.id });
    expect(unavailable.status).toBe(200);
    expect(unavailable.body.data.verification.status).toBe("UNAVAILABLE");
    expect(unavailable.body.data.verification.status).not.toBe("MATCH");
    assertNoSecrets(unavailable.body);
  });

  it("rejects malformed identifiers and missing hashes without leaking internals", async () => {
    const auditor = await privileged(Role.AUDITOR);
    const malformed = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({ evidenceId: "not-a-uuid", sha256: "deadbeef" });
    expect(malformed.status).toBe(400);
    expect(JSON.stringify(malformed.body)).not.toMatch(/at\s+\w+\s+\(/);
    assertNoSecrets(malformed.body);

    const missing = await request(app)
      .post("/api/v1/verification")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({});
    expect(missing.status).toBe(400);

    const publicMalformed = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "not-a-uuid")
      .attach("file", Buffer.from("x"), "x.txt");
    expect(publicMalformed.status).toBe(400);
    assertNoSecrets(publicMalformed.body);
  });
});
