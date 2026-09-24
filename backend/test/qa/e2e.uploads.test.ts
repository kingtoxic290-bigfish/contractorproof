import { readdirSync } from "fs";
import path from "path";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { env } from "../../src/config/env";
import { prisma } from "../../src/repositories/prisma";
import { EVIDENCE_MAX_FILE_BYTES } from "../../src/services/evidence";
import {
  assertNoSecrets,
  cleanupQaUsers,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

describe("evidence upload validation and storage containment", () => {
  afterEach(cleanupQaUsers);

  it("rejects empty, oversized, unsupported, missing, and traversal filenames", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("valid-upload");

    const empty = await uploadEvidence(owner.token, milestone.id, Buffer.alloc(0), "empty.txt");
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("FILE_EMPTY");
    expect(empty.body.error.requestId).toEqual(expect.any(String));

    const oversized = await uploadEvidence(
      owner.token,
      milestone.id,
      Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1, 1),
      "big.txt",
    );
    expect(oversized.status).toBe(400);
    expect(oversized.body.error.code).toBe("FILE_TOO_LARGE");

    const exe = await uploadEvidence(owner.token, milestone.id, bytes, "payload.exe");
    expect(exe.status).toBe(400);
    expect(exe.body.error.code).toBe("FILE_TYPE_NOT_ALLOWED");

    const missingFile = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", milestone.id);
    expect(missingFile.status).toBe(400);

    const missingMilestone = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .attach("file", bytes, "ok.txt");
    expect(missingMilestone.status).toBe(400);

    const malformed = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .set("Content-Type", "multipart/form-data")
      .send("not-multipart");
    expect([400, 500]).toContain(malformed.status);
    assertNoSecrets(malformed.body);

    const traversal = await uploadEvidence(
      owner.token,
      milestone.id,
      bytes,
      "../../secret.txt",
    );
    expect(traversal.status).toBe(201);
    expect(traversal.body.data.evidence.fileName).toBe("secret.txt");
    const stored = await prisma.evidenceVersion.findUnique({
      where: { id: traversal.body.data.evidence.currentVersionId },
    });
    expect(stored?.storageReference).not.toContain("..");
    expect(stored?.fileName).toBe("secret.txt");
    const root = path.resolve(env.storagePath);
    const names = readdirSync(root);
    expect(names).toContain(stored!.storageReference);
    expect(stored!.storageReference).not.toMatch(/\.\./);
    assertNoSecrets(traversal.body);

    const windowsTraversal = await uploadEvidence(
      owner.token,
      milestone.id,
      Buffer.from("windows-traversal"),
      "..\\..\\secret2.txt",
    );
    expect(windowsTraversal.status).toBe(201);
    expect(windowsTraversal.body.data.evidence.fileName).toBe("secret2.txt");

    const passwd = await uploadEvidence(
      owner.token,
      milestone.id,
      Buffer.from("passwd-traversal"),
      "../../../etc/passwd",
    );
    expect(passwd.status).toBe(400);
    expect(passwd.body.error.code).toBe("FILE_TYPE_NOT_ALLOWED");
    expect(JSON.stringify(passwd.body)).not.toContain("/etc/passwd");
    expect(JSON.stringify(passwd.body)).not.toContain("storage/");
    assertNoSecrets(passwd.body);
  });

  it("rejects a duplicate current hash on the same milestone", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("duplicate-hash-bytes");
    const first = await uploadEvidence(owner.token, milestone.id, bytes, "one.txt");
    expect(first.status).toBe(201);
    const second = await uploadEvidence(owner.token, milestone.id, bytes, "two.txt");
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("HASH_CONFLICT");
  });
});
