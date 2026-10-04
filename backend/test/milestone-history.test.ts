import { Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { evidenceService } from "../src/services/evidence";
import {
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
  uploadEvidence,
} from "./qa/fixtures";

afterEach(cleanupQaUsers);

async function createProjectAndMilestone(
  clientToken: string,
  contractorId: string,
  name = "History Project",
) {
  const project = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ name, contractorId });
  expect(project.status).toBe(201);
  const projectId = project.body.data.project.id as string;
  const milestone = await request(app)
    .post(`/api/v1/projects/${projectId}/milestones`)
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ name: "History Milestone" });
  expect(milestone.status).toBe(201);
  return { projectId, milestoneId: milestone.body.data.milestone.id as string };
}

async function transition(token: string, milestoneId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/v1/milestones/${milestoneId}/transitions`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

async function getHistory(token: string, milestoneId: string) {
  return request(app)
    .get(`/api/v1/milestones/${milestoneId}/history`)
    .set("Authorization", `Bearer ${token}`);
}

describe("append-only milestone execution history", () => {
  it("records the initial state and preserves ordered submission and approval transitions", async () => {
    const client = await registerClient("Milestone Owner");
    const contractor = await registerContractor("Assigned History Contractor");
    const auditor = await privileged(Role.AUDITOR, "History Auditor");
    const { projectId, milestoneId } = await createProjectAndMilestone(
      client.token,
      contractor.contractorId,
    );

    const initial = await getHistory(client.token, milestoneId);
    expect(initial.status, JSON.stringify(initial.body)).toBe(200);
    expect(initial.body.data.history).toHaveLength(1);
    expect(initial.body.data.history[0]).toMatchObject({
      sequence: 0,
      previousStatus: null,
      newStatus: "PENDING",
      actorName: "Milestone Owner",
      actorRole: "CLIENT",
      isBaseline: true,
    });

    const started = await transition(contractor.token, milestoneId, { status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    expect(started.body.data.milestone.status).toBe("IN_PROGRESS");

    // A CONTRACTOR may never drive a verification, so this is refused on role
    // alone. It is deliberately not a 409: telling the caller that
    // IN_PROGRESS cannot reach VERIFIED would hand an actor who cannot verify
    // the shape of the state machine.
    const forbiddenVerify = await transition(contractor.token, milestoneId, {
      status: "VERIFIED",
      evidenceId: "00000000-0000-4000-8000-000000000000",
    });
    expect(forbiddenVerify.status).toBe(403);
    expect(forbiddenVerify.body.error.code).toBe("FORBIDDEN");

    // The CLIENT is allowed to verify, so the same request reaches the state
    // machine and is refused there for being an illegal jump.
    const invalidJump = await transition(client.token, milestoneId, {
      status: "VERIFIED",
      evidenceId: "00000000-0000-4000-8000-000000000000",
    });
    expect(invalidJump.status).toBe(409);
    expect(invalidJump.body.error.code).toBe("CONFLICT");

    const foreignContractor = await registerContractor("Unassigned History Contractor");
    const forbiddenTransition = await transition(foreignContractor.token, milestoneId, {
      status: "IN_PROGRESS",
    });
    expect(forbiddenTransition.status).toBe(403);

    const upload = await uploadEvidence(
      contractor.token,
      milestoneId,
      Buffer.from("initial execution evidence"),
      "initial.txt",
    );
    expect(upload.status).toBe(201);
    const evidenceId = upload.body.data.evidence.id as string;

    const submitted = await transition(contractor.token, milestoneId, {
      status: "PENDING_VERIFICATION",
      evidenceId,
    });
    expect(submitted.status).toBe(200);

    const prematureApproval = await transition(client.token, milestoneId, {
      status: "VERIFIED",
      evidenceId,
    });
    expect(prematureApproval.status).toBe(409);

    await prisma.attestation.create({
      data: {
        milestoneId,
        evidenceId,
        verifierId: auditor.userId,
        verifierRole: Role.AUDITOR,
        decision: "APPROVED",
      },
    });
    const approved = await transition(client.token, milestoneId, {
      status: "VERIFIED",
      evidenceId,
      reason: "Evidence reviewed and approved",
    });
    expect(approved.status).toBe(200);
    expect(approved.body.data.milestone.status).toBe("VERIFIED");

    const history = await getHistory(client.token, milestoneId);
    expect(history.status).toBe(200);
    expect(history.body.data.history.map((entry: { sequence: number }) => entry.sequence))
      .toEqual([0, 1, 2, 3]);
    expect(history.body.data.history.map((entry: { newStatus: string }) => entry.newStatus))
      .toEqual(["PENDING", "IN_PROGRESS", "PENDING_VERIFICATION", "VERIFIED"]);
    expect(history.body.data.history.map((entry: { previousStatus: string | null }) => entry.previousStatus))
      .toEqual([null, "PENDING", "IN_PROGRESS", "PENDING_VERIFICATION"]);
    expect(history.body.data.history[2].evidenceId).toBe(evidenceId);
    expect(history.body.data.history[3]).toMatchObject({
      actorName: "Milestone Owner",
      actorRole: "CLIENT",
      evidenceId,
      reason: "Evidence reviewed and approved",
    });
    expect(history.body.data.history[3]).not.toHaveProperty("actorId");
    const persistedApproval = await prisma.milestoneStatusHistory.findUniqueOrThrow({
      where: { id: history.body.data.history[3].id },
    });
    expect(persistedApproval.actorId).toBe(client.userId);

    const terminalTransition = await transition(contractor.token, milestoneId, {
      status: "IN_PROGRESS",
    });
    expect(terminalTransition.status).toBe(409);

    const passport = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(passport.status).toBe(200);
    expect(passport.body.contractorPassport.projects[0].milestones[0].statusHistory)
      .toHaveLength(4);
    expect(passport.body.contractorPassport.projects[0].milestones[0].statusHistory[3].evidenceId)
      .toBe(evidenceId);
    expect(passport.body.contractorPassport.projects[0].milestones[0].statusHistory[3])
      .not.toHaveProperty("actorId");
    expect(passport.body.contractorPassport.projects[0].milestones[0])
      .not.toHaveProperty("statusHistory.actorId");

    const projectPassport = await request(app)
      .get(`/api/v1/passports/${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(projectPassport.status).toBe(200);
    expect(projectPassport.body.data.passport.milestones[0].statusHistory)
      .toHaveLength(4);
  });

  it("records rejection and rework as new transitions without erasing earlier history or evidence versions", async () => {
    const client = await registerClient("Rework Project Owner");
    const contractor = await registerContractor("Rework Contractor");
    const reviewer = await privileged(Role.AUDITOR, "Rework Reviewer");
    const { milestoneId } = await createProjectAndMilestone(client.token, contractor.contractorId);
    await transition(contractor.token, milestoneId, { status: "IN_PROGRESS" });

    const firstUpload = await uploadEvidence(
      contractor.token,
      milestoneId,
      Buffer.from("first submitted version"),
      "first.txt",
    );
    const evidenceId = firstUpload.body.data.evidence.id as string;
    const firstVersionId = firstUpload.body.data.evidence.currentVersionId as string;
    const firstVersion = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { id: firstVersionId },
    });
    await transition(contractor.token, milestoneId, {
      status: "PENDING_VERIFICATION",
      evidenceId,
    });
    await prisma.attestation.create({
      data: {
        milestoneId,
        evidenceId,
        verifierId: reviewer.userId,
        verifierRole: Role.AUDITOR,
        decision: "REJECTED",
      },
    });
    const rejected = await transition(client.token, milestoneId, {
      status: "REJECTED",
      evidenceId,
      reason: "Visible defect remains",
    });
    expect(rejected.status).toBe(200);

    const secondBytes = Buffer.from("corrected version two");
    await evidenceService.appendVersion({
      evidenceId,
      uploadedById: contractor.userId,
      buffer: secondBytes,
      originalName: "second.txt",
      mimeType: "text/plain",
    });
    const version2 = await prisma.evidenceVersion.findUniqueOrThrow({
      where: { evidenceId_versionNumber: { evidenceId, versionNumber: 2 } },
    });
    await prisma.verification.create({
      data: {
        evidenceVersionId: firstVersionId,
        status: "MATCH",
        authoritativeSha256: firstVersion.sha256,
        source: "INTERNAL",
      },
    });
    await prisma.verification.create({
      data: {
        evidenceVersionId: version2.id,
        status: "MISMATCH",
        presentedSha256: "c".repeat(64),
        authoritativeSha256: version2.sha256,
        source: "INTERNAL",
      },
    });

    const rework = await transition(contractor.token, milestoneId, {
      status: "IN_PROGRESS",
      reason: "Rework started",
    });
    expect(rework.status).toBe(200);

    const [history, evidenceVersions, verifications] = await Promise.all([
      getHistory(client.token, milestoneId),
      prisma.evidenceVersion.findMany({ where: { evidenceId }, orderBy: { versionNumber: "asc" } }),
      prisma.verification.findMany({ where: { evidenceVersion: { evidenceId } }, orderBy: { createdAt: "asc" } }),
    ]);
    expect(history.body.data.history.map((entry: { newStatus: string }) => entry.newStatus))
      .toEqual(["PENDING", "IN_PROGRESS", "PENDING_VERIFICATION", "REJECTED", "IN_PROGRESS"]);
    expect(history.body.data.history.map((entry: { sequence: number }) => entry.sequence))
      .toEqual([0, 1, 2, 3, 4]);
    expect(evidenceVersions.map((version) => version.id)).toEqual([firstVersionId, version2.id]);
    expect(evidenceVersions.map((version) => version.sha256)).toEqual([
      firstVersion.sha256,
      version2.sha256,
    ]);
    expect(verifications.map((verification) => verification.status)).toEqual(["MATCH", "MISMATCH"]);
  });

  it("denies cross-project history reads and direct history mutation", async () => {
    const owner = await registerClient("History Security Owner");
    const otherClient = await registerClient("History Security Stranger");
    const contractor = await registerContractor("History Security Contractor");
    const otherContractor = await registerContractor("History Security Other Contractor");
    const first = await createProjectAndMilestone(owner.token, contractor.contractorId);
    const second = await createProjectAndMilestone(otherClient.token, otherContractor.contractorId, "Other History Project");

    const strangerRead = await getHistory(otherClient.token, first.milestoneId);
    expect(strangerRead.status).toBe(403);
    const unrelatedContractorRead = await getHistory(otherContractor.token, first.milestoneId);
    expect(unrelatedContractorRead.status).toBe(403);
    const unrelatedTransition = await transition(otherContractor.token, first.milestoneId, {
      status: "IN_PROGRESS",
    });
    expect(unrelatedTransition.status).toBe(403);

    const baseline = await prisma.milestoneStatusHistory.findFirstOrThrow({
      where: { milestoneId: second.milestoneId },
    });
    await expect(prisma.milestoneStatusHistory.update({
      where: { id: baseline.id },
      data: { newStatus: "VERIFIED" },
    })).rejects.toThrow(/append-only/i);
    await expect(prisma.milestoneStatusHistory.delete({
      where: { id: baseline.id },
    })).rejects.toThrow(/append-only/i);
  });

  it("preserves immutable history when a milestone row is physically deleted", async () => {
    const client = await registerClient("Deleted Milestone Owner");
    const contractor = await registerContractor("Deleted Milestone Contractor");
    const { milestoneId } = await createProjectAndMilestone(client.token, contractor.contractorId);
    const started = await transition(contractor.token, milestoneId, { status: "IN_PROGRESS" });
    expect(started.status).toBe(200);
    const baseline = await prisma.milestoneStatusHistory.findFirstOrThrow({
      where: { milestoneId },
    });

    await prisma.milestone.delete({ where: { id: milestoneId } });

    expect(await prisma.milestone.findUnique({ where: { id: milestoneId } })).toBeNull();
    const retained = await prisma.milestoneStatusHistory.findMany({ where: { milestoneId } });
    expect(retained).toHaveLength(2);
    expect(retained.map((entry) => entry.sequence)).toEqual([0, 1]);
    expect(retained.map((entry) => entry.newStatus)).toEqual(["PENDING", "IN_PROGRESS"]);
    expect(retained[0]).toMatchObject({ id: baseline.id, isBaseline: true, previousStatus: null });
    expect(retained[1]).toMatchObject({ previousStatus: "PENDING", isBaseline: false });
    await expect(prisma.milestoneStatusHistory.delete({
      where: { id: baseline.id },
    })).rejects.toThrow(/append-only/i);
  });
});
