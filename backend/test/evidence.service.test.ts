import { mkdtemp, readFile, rm } from "fs/promises";
import os from "os";
import path from "path";
import { randomUUID } from "crypto";
import { BlockchainEventType, Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/repositories/prisma";
import { sha256Buffer } from "../src/utils/hash";
import { LocalFilesystemStorageService } from "../src/services/storage/LocalFilesystemStorageService";
import type { StorageService, StoredFile } from "../src/services/storage/StorageService";
import { EvidenceService } from "../src/services/evidence/evidence.service";
import { VerificationService } from "../src/services/evidence/verification.service";
import { EVIDENCE_ERROR_CODES, EvidenceError } from "../src/services/evidence/errors";
import { EVIDENCE_MAX_FILE_BYTES } from "../src/services/evidence/config";

async function seedMilestone() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `agent5-${suffix}@example.com`,
      passwordHash: "not-a-real-hash",
      fullName: "Agent 5 Test",
      role: Role.CONTRACTOR,
    },
  });
  const contractor = await prisma.contractor.create({
    data: { userId: user.id, legalName: "Agent 5 Contractor" },
  });
  const project = await prisma.project.create({
    data: { contractorId: contractor.id, name: "Agent 5 Project" },
  });
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, name: "Agent 5 Milestone" },
  });
  return { user, contractor, project, milestone };
}

async function cleanupUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      contractor: { include: { projects: { include: { milestones: true } } } },
      uploadedEvidence: true,
    },
  });
  if (!user) {
    return;
  }
  const evidenceIds = user.uploadedEvidence.map((row) => row.id);
  if (evidenceIds.length > 0) {
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({ where: { evidenceId: { in: evidenceIds } } });
    await prisma.evidence.deleteMany({ where: { id: { in: evidenceIds } } });
  }
  await prisma.blockchainEvent.deleteMany({
    where: { project: { contractor: { userId } } },
  });
  const milestoneIds =
    user.contractor?.projects.flatMap((project) => project.milestones.map((row) => row.id)) ?? [];
  if (milestoneIds.length > 0) {
    await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
  }
  const projectIds = user.contractor?.projects.map((project) => project.id) ?? [];
  if (projectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (user.contractor) {
    await prisma.contractor.delete({ where: { id: user.contractor.id } });
  }
  await prisma.user.delete({ where: { id: user.id } });
}

describe("EvidenceService and VerificationService", () => {
  let userId = "";
  let storageDir = "";
  let storage: LocalFilesystemStorageService;
  let evidenceService: EvidenceService;
  let verificationService: VerificationService;

  async function setup() {
    storageDir = await mkdtemp(path.join(os.tmpdir(), "cp-evidence-"));
    storage = new LocalFilesystemStorageService(storageDir);
    evidenceService = new EvidenceService(storage);
    verificationService = new VerificationService(storage);
    return seedMilestone();
  }

  afterEach(async () => {
    if (userId) {
      await cleanupUser(userId);
      userId = "";
    }
    if (storageDir) {
      await rm(storageDir, { recursive: true, force: true });
      storageDir = "";
    }
  });

  it("stores bytes, hashes them, and creates version 1", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const bytes = Buffer.from("original-site-photo");
    const expectedHash = sha256Buffer(bytes);

    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "site.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });

    expect(created.currentVersion?.versionNumber).toBe(1);
    expect(created.currentVersionId).toBe(created.currentVersion?.id);
    expect(created.sha256).toBe(expectedHash);
    expect(created.currentVersion?.sha256).toBe(expectedHash);
    expect(created.status).toBe("PENDING_VERIFICATION");
    expect(created.verificationStatus).toBe("PENDING");
    expect(JSON.stringify(created)).not.toContain(storageDir);

    const row = await prisma.evidence.findUnique({
      where: { id: created.id },
      include: { currentVersion: true },
    });
    const stored = await storage.read(row!.currentVersion!.storageReference);
    expect(stored.equals(bytes)).toBe(true);
    expect(row!.storageKey).toBe(row!.currentVersion!.storageReference);
  });

  it("creates version 2 without changing version 1 and updates current denormalized fields", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const original = Buffer.from("version-one-bytes");
    const modified = Buffer.from("version-two-bytes");

    const first = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "v1.png",
      mimeType: "image/png",
      buffer: original,
    });
    const version1 = first.currentVersion!;

    const second = await evidenceService.appendVersion({
      evidenceId: first.id,
      uploadedById: user.id,
      originalName: "v2.png",
      mimeType: "image/png",
      buffer: modified,
    });

    expect(second.currentVersion?.versionNumber).toBe(2);
    expect(second.currentVersionId).toBe(second.currentVersion?.id);
    expect(second.currentVersionId).not.toBe(version1.id);
    expect(second.sha256).toBe(sha256Buffer(modified));
    expect(second.sha256).not.toBe(version1.sha256);

    const persistedV1 = await prisma.evidenceVersion.findUnique({ where: { id: version1.id } });
    expect(persistedV1?.sha256).toBe(sha256Buffer(original));
    expect(persistedV1?.versionNumber).toBe(1);
    expect(persistedV1?.fileName).toBe("v1.png");

    const evidence = await prisma.evidence.findUnique({
      where: { id: first.id },
      include: { currentVersion: true, versions: true },
    });
    expect(evidence?.versions).toHaveLength(2);
    expect(evidence?.sha256).toBe(sha256Buffer(modified));
    expect(evidence?.storageKey).toBe(evidence?.currentVersion?.storageReference);
    expect(evidence?.fileName).toBe("v2.png");
  });

  it("produces identical SHA-256 for identical bytes and a different digest after tamper", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const original = Buffer.from("tamper-source");
    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "a.pdf",
      mimeType: "application/pdf",
      buffer: original,
    });
    expect(created.sha256).toBe(sha256Buffer(Buffer.from("tamper-source")));
    expect(created.sha256).toBe(sha256Buffer(original));
    expect(sha256Buffer(Buffer.from("tamper-source!"))).not.toBe(created.sha256);
  });

  it("records MATCH and MISMATCH without changing workflow status", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const original = Buffer.from("authoritative-bytes");
    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "proof.jpg",
      mimeType: "image/jpeg",
      buffer: original,
    });

    const match = await verificationService.compare({
      presentedBytes: Buffer.from("authoritative-bytes"),
      evidenceId: created.id,
      source: "INTERNAL",
      requestedById: user.id,
    });
    expect(match.status).toBe("MATCH");
    expect(match.source).toBe("INTERNAL");
    expect(match.id).toBeTruthy();
    expect(match.sha256).toBe(created.sha256);

    const mismatch = await verificationService.compare({
      presentedBytes: Buffer.from("authoritative-bytes-tampered"),
      evidenceVersionId: created.currentVersionId!,
      source: "PUBLIC",
    });
    expect(mismatch.status).toBe("MISMATCH");
    expect(mismatch.source).toBe("PUBLIC");
    expect(mismatch.status).not.toBe("PENDING_VERIFICATION" as never);
    expect(mismatch.meaning).toMatch(/does not match/i);

    const rows = await prisma.verification.findMany({
      where: { evidenceVersionId: created.currentVersionId! },
      orderBy: { createdAt: "asc" },
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.source).toBe("INTERNAL");
    expect(rows[0]?.requestedById).toBe(user.id);
    expect(rows[1]?.source).toBe("PUBLIC");
    expect(rows[1]?.requestedById).toBeNull();

    const evidence = await prisma.evidence.findUnique({ where: { id: created.id } });
    expect(evidence?.status).toBe("PENDING_VERIFICATION");
  });

  it("returns a public view without storage paths or requester identity", async () => {
    const { user, project, milestone } = await setup();
    userId = user.id;
    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "public.png",
      mimeType: "image/png",
      buffer: Buffer.from("public-bytes"),
    });
    const version = await prisma.evidenceVersion.findUnique({
      where: { id: created.currentVersionId! },
    });
    await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${created.currentVersionId}`,
        referenceId: created.currentVersionId,
        evidenceHash: version!.sha256,
        txHash: `0x${"ab".repeat(32)}`,
        blockNumber: 2,
      },
    });

    const publicResult = await verificationService.comparePublic({
      presentedBytes: Buffer.from("public-bytes"),
      evidenceVersionId: created.currentVersionId!,
      requestedById: user.id,
    });

    expect(publicResult.status).toBe("MATCH");
    expect(publicResult.evidenceVersionId).toBe(created.currentVersionId);
    expect(JSON.stringify(publicResult)).not.toContain(storageDir);
    expect(JSON.stringify(publicResult)).not.toContain(user.email);
    expect(publicResult).not.toHaveProperty("requestedById");
  });

  it("rejects empty, oversized, and disallowed files before storage", async () => {
    const { user, milestone } = await setup();
    userId = user.id;

    await expect(
      evidenceService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "empty.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.alloc(0),
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.FILE_EMPTY });

    await expect(
      evidenceService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "big.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.alloc(EVIDENCE_MAX_FILE_BYTES + 1, 1),
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.FILE_TOO_LARGE });

    await expect(
      evidenceService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "payload.exe",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not-allowed"),
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED });

    expect(await prisma.evidence.count({ where: { uploadedById: user.id } })).toBe(0);
    const leftovers = await readFile(path.join(storageDir, "should-not-exist")).catch(() => null);
    expect(leftovers).toBeNull();
  });

  it("does not create metadata when storage fails", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const failingStorage: StorageService = {
      async save(): Promise<StoredFile> {
        throw new Error("disk full");
      },
      async read(): Promise<Buffer> {
        throw new Error("unused");
      },
      async remove(): Promise<void> {
        return;
      },
    };
    const failingService = new EvidenceService(failingStorage);

    await expect(
      failingService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "site.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("never-stored"),
      }),
    ).rejects.toBeInstanceOf(EvidenceError);

    expect(await prisma.evidence.count({ where: { uploadedById: user.id } })).toBe(0);
  });

  it("removes the stored object if database metadata cannot be written", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const bytes = Buffer.from("duplicate-hash-bytes");
    await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "one.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });

    let removedKey: string | undefined;
    const trackingStorage: StorageService = {
      save: (params) => storage.save(params),
      read: (key) => storage.read(key),
      remove: async (key) => {
        removedKey = key;
        await storage.remove(key);
      },
    };
    const retryService = new EvidenceService(trackingStorage);

    await expect(
      retryService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "two.jpg",
        mimeType: "image/jpeg",
        buffer: bytes,
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.HASH_CONFLICT });

    expect(removedKey).toBeTruthy();
    await expect(storage.read(removedKey!)).rejects.toThrow();
    expect(await prisma.evidence.count({ where: { uploadedById: user.id } })).toBe(1);
  });

  it("ignores client-supplied hashes and storage paths", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const bytes = Buffer.from("server-hashed");
    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "../../../etc/passwd.jpg",
      mimeType: "image/jpeg",
      buffer: bytes,
    });

    expect(created.fileName).toBe("passwd.jpg");
    expect(created.sha256).toBe(sha256Buffer(bytes));
    expect(created.sha256).not.toBe("deadbeef");
    const row = await prisma.evidence.findUnique({
      where: { id: created.id },
      include: { currentVersion: true },
    });
    expect(row?.currentVersion?.storageReference).not.toContain("..");
    expect(row?.currentVersion?.storageReference).not.toContain("/etc/passwd");
  });

  it("rejects an unknown milestone and a MIME/extension mismatch before storage", async () => {
    const { user, milestone } = await setup();
    userId = user.id;

    await expect(
      evidenceService.create({
        milestoneId: randomUUID(),
        uploadedById: user.id,
        originalName: "site.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("no-milestone"),
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.MILESTONE_NOT_FOUND });

    await expect(
      evidenceService.create({
        milestoneId: milestone.id,
        uploadedById: user.id,
        originalName: "site.jpg",
        mimeType: "application/pdf",
        buffer: Buffer.from("mime-mismatch"),
      }),
    ).rejects.toMatchObject({ code: EVIDENCE_ERROR_CODES.FILE_TYPE_NOT_ALLOWED });

    expect(await prisma.evidence.count({ where: { uploadedById: user.id } })).toBe(0);
  });

  it("lists versions without storage paths and keeps historical rows readable", async () => {
    const { user, milestone, project } = await setup();
    userId = user.id;
    const first = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "v1.png",
      mimeType: "image/png",
      buffer: Buffer.from("list-v1"),
    });
    await evidenceService.appendVersion({
      evidenceId: first.id,
      uploadedById: user.id,
      originalName: "v2.png",
      mimeType: "image/png",
      buffer: Buffer.from("list-v2"),
    });

    const versions = await evidenceService.listVersions(first.id);
    expect(versions.map((row) => row.versionNumber)).toEqual([1, 2]);
    expect(JSON.stringify(versions)).not.toContain(storageDir);
    expect(versions[0]).not.toHaveProperty("storageReference");

    const listed = await evidenceService.listByProject(project.id);
    expect(listed).toHaveLength(1);
    expect(listed[0]?.currentVersion?.versionNumber).toBe(2);

    const bytes = await evidenceService.readVersionBytes(versions[0]!.id);
    expect(bytes.buffer.equals(Buffer.from("list-v1"))).toBe(true);
    expect(bytes).not.toHaveProperty("storageReference");
    expect(JSON.stringify({ ...bytes, buffer: undefined })).not.toContain(storageDir);
  });

  it("self-checks stored bytes as MATCH and reports UNAVAILABLE when the record is missing", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const created = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "self.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("self-check-bytes"),
    });

    const selfCheck = await verificationService.compareStored({
      evidenceId: created.id,
      source: "INTERNAL",
      requestedById: user.id,
    });
    expect(selfCheck.status).toBe("MATCH");
    expect(selfCheck.source).toBe("INTERNAL");

    const missing = await verificationService.compare({
      presentedBytes: Buffer.from("anything"),
      evidenceVersionId: randomUUID(),
      source: "PUBLIC",
    });
    expect(missing.status).toBe("UNAVAILABLE");
    expect(missing.id).toBeNull();
    expect(JSON.stringify(missing)).not.toContain(storageDir);
  });

  it("does not assign colliding version numbers on concurrent appends", async () => {
    const { user, milestone } = await setup();
    userId = user.id;
    const first = await evidenceService.create({
      milestoneId: milestone.id,
      uploadedById: user.id,
      originalName: "base.png",
      mimeType: "image/png",
      buffer: Buffer.from("concurrent-base"),
    });

    const [left, right] = await Promise.all([
      evidenceService.appendVersion({
        evidenceId: first.id,
        uploadedById: user.id,
        originalName: "a.png",
        mimeType: "image/png",
        buffer: Buffer.from("concurrent-a"),
      }),
      evidenceService.appendVersion({
        evidenceId: first.id,
        uploadedById: user.id,
        originalName: "b.png",
        mimeType: "image/png",
        buffer: Buffer.from("concurrent-b"),
      }),
    ]);

    const versions = await evidenceService.listVersions(first.id);
    const numbers = versions.map((row) => row.versionNumber).sort((a, b) => a - b);
    expect(numbers).toEqual([1, 2, 3]);
    expect(new Set([left.currentVersionId, right.currentVersionId]).size).toBe(2);
    expect(versions.every((row) => row.sha256.length === 64)).toBe(true);
  });
});
