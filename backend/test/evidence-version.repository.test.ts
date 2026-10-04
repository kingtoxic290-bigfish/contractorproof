import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "../src/repositories/prisma";
import { evidenceRepository } from "../src/repositories/evidence.repository";
import { evidenceVersionRepository } from "../src/repositories/evidenceVersion.repository";
import { verificationRepository } from "../src/repositories/verification.repository";
import { RepositoryError } from "../src/repositories/errors";

const HASH_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HASH_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

async function seedMilestone() {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: {
      email: `agent3-${suffix}@example.com`,
      passwordHash: "not-a-real-hash",
      fullName: "Agent 3 Test",
      role: Role.CONTRACTOR,
    },
  });
  const contractor = await prisma.contractor.create({
    data: {
      userId: user.id,
      legalName: "Agent 3 Contractor",
    },
  });
  const project = await prisma.project.create({
    data: {
      contractorId: contractor.id,
      name: "Agent 3 Project",
    },
  });
  const milestone = await prisma.milestone.create({
    data: {
      projectId: project.id,
      name: "Agent 3 Milestone",
    },
  });
  return { user, contractor, project, milestone };
}

async function cleanup(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      contractor: true,
      uploadedEvidence: true,
    },
  });
  if (!user) {
    return;
  }

  const contractorId = user.contractor?.id;
  const projectIds = contractorId
    ? await prisma.project
        .findMany({ where: { contractorId }, select: { id: true } })
        .then((rows) => rows.map((row) => row.id))
    : [];

  const milestoneIds = projectIds.length
    ? await prisma.milestone
        .findMany({ where: { projectId: { in: projectIds } }, select: { id: true } })
        .then((rows) => rows.map((row) => row.id))
    : [];

  const evidenceIds = milestoneIds.length
    ? await prisma.evidence
        .findMany({ where: { milestoneId: { in: milestoneIds } }, select: { id: true } })
        .then((rows) => rows.map((row) => row.id))
    : user.uploadedEvidence.map((row) => row.id);

  if (evidenceIds.length > 0) {
    await prisma.verification.deleteMany({
      where: { evidenceVersion: { evidenceId: { in: evidenceIds } } },
    });
    await prisma.evidence.updateMany({
      where: { id: { in: evidenceIds } },
      data: { currentVersionId: null },
    });
    await prisma.evidenceVersion.deleteMany({
      where: { evidenceId: { in: evidenceIds } },
    });
    await prisma.evidence.deleteMany({
      where: { id: { in: evidenceIds } },
    });
  }

  if (milestoneIds.length > 0) {
    await prisma.milestone.deleteMany({ where: { id: { in: milestoneIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (contractorId) {
    await prisma.contractor.delete({ where: { id: contractorId } });
  }
  await prisma.user.delete({ where: { id: user.id } });
}

describe("evidence versioning", () => {
  let userId = "";

  afterEach(async () => {
    if (userId) {
      await cleanup(userId);
      userId = "";
    }
  });

  it("creates evidence with an initial version that stores SHA-256", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    const evidence = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "site.jpg",
      storageReference: "version-1.bin",
      mimeType: "image/jpeg",
      sizeBytes: 128,
      sha256: HASH_A.toUpperCase(),
    });

    expect(evidence.versions).toHaveLength(1);
    expect(evidence.currentVersionId).toBe(evidence.versions[0]?.id);
    expect(evidence.currentVersion?.sha256).toBe(HASH_A);
    expect(evidence.sha256).toBe(HASH_A);
    expect(evidence.storageKey).toBe("version-1.bin");
    expect(evidence.currentVersion?.storageReference).toBe("version-1.bin");
    expect(evidence.status).toBe("PENDING_VERIFICATION");
  });

  it("keeps previous versions when current moves to a newer version", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    const initial = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "v1.pdf",
      storageReference: "v1",
      mimeType: "application/pdf",
      sizeBytes: 10,
      sha256: HASH_A,
    });
    const firstVersionId = initial.versions[0]?.id;
    expect(firstVersionId).toBeTruthy();

    const updated = await evidenceRepository.appendVersion({
      evidenceId: initial.id,
      fileName: "v2.pdf",
      storageReference: "v2",
      mimeType: "application/pdf",
      sizeBytes: 20,
      sha256: HASH_B,
    });

    expect(updated.versions).toHaveLength(2);
    expect(updated.currentVersion?.sha256).toBe(HASH_B);
    expect(updated.sha256).toBe(HASH_B);
    expect(updated.storageKey).toBe("v2");

    const previous = await evidenceVersionRepository.findById(firstVersionId!);
    expect(previous).not.toBeNull();
    expect(previous?.sha256).toBe(HASH_A);
    expect(previous?.storageReference).toBe("v1");
    expect(previous?.evidenceId).toBe(initial.id);

    const all = await evidenceVersionRepository.findByEvidenceId(initial.id);
    expect(all.map((row) => row.sha256)).toEqual([HASH_A, HASH_B]);
  });

  it("does not silently replace SHA-256 on an old version", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    const initial = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "v1.bin",
      storageReference: "old-key",
      mimeType: "application/octet-stream",
      sizeBytes: 4,
      sha256: HASH_A,
    });
    const oldId = initial.versions[0]!.id;

    await evidenceRepository.appendVersion({
      evidenceId: initial.id,
      fileName: "v2.bin",
      storageReference: "new-key",
      mimeType: "application/octet-stream",
      sizeBytes: 8,
      sha256: HASH_B,
    });

    const old = await prisma.evidenceVersion.findUnique({ where: { id: oldId } });
    expect(old?.sha256).toBe(HASH_A);
    expect(old?.storageReference).toBe("old-key");
    expect(old?.versionNumber).toBe(1);
    expect(old?.fileName).toBe("v1.bin");
  });

  it("rejects pointing current version at a different evidence item", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    const first = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "a.bin",
      storageReference: "a",
      mimeType: "application/octet-stream",
      sizeBytes: 1,
      sha256: HASH_A,
    });
    const second = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "b.bin",
      storageReference: "b",
      mimeType: "application/octet-stream",
      sizeBytes: 1,
      sha256: HASH_B,
    });

    await expect(
      evidenceRepository.setCurrentVersion(first.id, second.versions[0]!.id),
    ).rejects.toBeInstanceOf(RepositoryError);
  });

  it("persists a verification compare against a version without changing workflow status", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    const evidence = await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "proof.bin",
      storageReference: "proof",
      mimeType: "application/octet-stream",
      sizeBytes: 2,
      sha256: HASH_A,
    });

    const verification = await verificationRepository.create({
      evidenceVersionId: evidence.versions[0]!.id,
      status: "MATCH",
      presentedSha256: HASH_A,
      authoritativeSha256: HASH_A,
      source: "PUBLIC",
      requestedById: null,
    });

    expect(verification.status).toBe("MATCH");
    const reloaded = await evidenceRepository.findById(evidence.id);
    expect(reloaded?.status).toBe("PENDING_VERIFICATION");
    expect(reloaded?.versions[0]?.sha256).toBe(HASH_A);
  });

  it("rolls back current-state and version history together when a write fails mid-transaction", async () => {
    const { user, milestone } = await seedMilestone();
    userId = user.id;

    await expect(
      prisma.$transaction(async (tx) => {
        const evidence = await tx.evidence.create({
          data: {
            milestoneId: milestone.id,
            uploadedById: user.id,
            fileName: "rollback.bin",
            storageKey: "rollback",
            mimeType: "application/octet-stream",
            sizeBytes: 5,
            sha256: HASH_A,
            status: "PENDING_VERIFICATION",
          },
        });

        await tx.evidenceVersion.create({
          data: {
            evidenceId: evidence.id,
            versionNumber: 1,
            storageReference: "rollback",
            fileName: "rollback.bin",
            mimeType: "application/octet-stream",
            sizeBytes: 5,
            sha256: HASH_A,
            createdById: user.id,
          },
        });

        throw new Error("simulated transaction failure");
      }),
    ).rejects.toThrow("simulated transaction failure");

    const evidenceRows = await prisma.evidence.findMany({
      where: { milestoneId: milestone.id },
    });
    const versionRows = await prisma.evidenceVersion.findMany({
      where: { evidence: { milestoneId: milestone.id } },
    });

    expect(evidenceRows).toEqual([]);
    expect(versionRows).toEqual([]);
  });

  it("leaves existing user and contractor rows valid after versioned evidence writes", async () => {
    const { user, contractor, project, milestone } = await seedMilestone();
    userId = user.id;

    await evidenceRepository.createWithInitialVersion({
      milestoneId: milestone.id,
      uploadedById: user.id,
      fileName: "keep.bin",
      storageReference: "keep",
      mimeType: "application/octet-stream",
      sizeBytes: 3,
      sha256: HASH_A,
    });

    const persistedUser = await prisma.user.findUnique({ where: { id: user.id } });
    const persistedContractor = await prisma.contractor.findUnique({
      where: { id: contractor.id },
    });
    const persistedProject = await prisma.project.findUnique({ where: { id: project.id } });
    expect(persistedUser?.email).toBe(user.email);
    expect(persistedContractor?.legalName).toBe("Agent 3 Contractor");
    expect(persistedProject?.name).toBe("Agent 3 Project");
    // Registration never asserts CRB data; a check must actually run first.
    expect(persistedContractor?.crbSource).toBeNull();
    expect(persistedProject?.nestSource).toBe("SYNTHETIC_DEMO");
  });
});
