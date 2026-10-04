import { Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import {
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
  uploadEvidence,
} from "./qa/fixtures";

afterEach(cleanupQaUsers);

async function createProject(clientToken: string, contractorId: string) {
  const response = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ name: "Completion Lifecycle Project", contractorId });
  expect(response.status).toBe(201);
  return response.body.data.project.id as string;
}

async function createMilestone(clientToken: string, projectId: string) {
  const response = await request(app)
    .post(`/api/v1/projects/${projectId}/milestones`)
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ name: "Completion Milestone" });
  expect(response.status).toBe(201);
  return response.body.data.milestone.id as string;
}

async function transitionProject(token: string, projectId: string, status: string) {
  return request(app)
    .post(`/api/v1/projects/${projectId}/lifecycle-transitions`)
    .set("Authorization", `Bearer ${token}`)
    .send({ status });
}

async function verifyMilestone(
  clientToken: string,
  contractorToken: string,
  milestoneId: string,
) {
  const started = await request(app)
    .post(`/api/v1/milestones/${milestoneId}/transitions`)
    .set("Authorization", `Bearer ${contractorToken}`)
    .send({ status: "IN_PROGRESS" });
  expect(started.status).toBe(200);

  const upload = await uploadEvidence(
    contractorToken,
    milestoneId,
    Buffer.from(`verified evidence ${milestoneId}`),
    "verified.txt",
  );
  expect(upload.status).toBe(201);
  const evidenceId = upload.body.data.evidence.id as string;
  const submitted = await request(app)
    .post(`/api/v1/milestones/${milestoneId}/transitions`)
    .set("Authorization", `Bearer ${contractorToken}`)
    .send({ status: "PENDING_VERIFICATION", evidenceId });
  expect(submitted.status).toBe(200);

  const attestation = await request(app)
    .post("/api/v1/attestations")
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ evidenceId, milestoneId, decision: "APPROVED" });
  expect(attestation.status).toBe(201);
  expect(attestation.body.data.attestation.verifierId).toBeUndefined();

  const verified = await request(app)
    .post(`/api/v1/milestones/${milestoneId}/transitions`)
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ status: "VERIFIED", evidenceId });
  expect(verified.status).toBe(200);
}

describe("auditable project completion lifecycle", () => {
  it("requires all milestones verified, enforces ownership, and preserves each completion transition", async () => {
    const client = await registerClient("Lifecycle Owner");
    const stranger = await registerClient("Lifecycle Stranger");
    const contractor = await registerContractor("Lifecycle Contractor");
    const otherContractor = await registerContractor("Other Lifecycle Contractor");
    const admin = await privileged(Role.ADMIN, "Lifecycle Admin");
    const projectId = await createProject(client.token, contractor.contractorId);
    const milestoneId = await createMilestone(client.token, projectId);

    const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
    expect(project.lifecycleStatus).toBe("CREATED");
    const baseline = await prisma.projectStatusHistory.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(baseline).toHaveLength(1);
    expect(baseline[0]).toMatchObject({
      previousStatus: null,
      sequence: 0,
      newStatus: "CREATED",
      actorId: client.userId,
      actorName: "Lifecycle Owner",
      actorRole: "CLIENT",
      isBaseline: true,
    });

    const invalidJump = await transitionProject(client.token, projectId, "COMPLETED");
    expect(invalidJump.status).toBe(409);

    const inProgress = await transitionProject(contractor.token, projectId, "IN_PROGRESS");
    expect(inProgress.status).toBe(200);
    expect(inProgress.body.data.project.lifecycleStatus).toBe("IN_PROGRESS");

    const lateMilestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Late scope change" });
    expect(lateMilestone.status).toBe(409);

    const contractorCompletion = await transitionProject(contractor.token, projectId, "EXECUTION_COMPLETE");
    expect(contractorCompletion.status).toBe(403);
    const unrelatedContractorCompletion = await transitionProject(
      otherContractor.token,
      projectId,
      "EXECUTION_COMPLETE",
    );
    expect(unrelatedContractorCompletion.status).toBe(403);
    const unrelatedCompletion = await transitionProject(stranger.token, projectId, "EXECUTION_COMPLETE");
    expect(unrelatedCompletion.status).toBe(403);

    const incomplete = await transitionProject(client.token, projectId, "EXECUTION_COMPLETE");
    expect(incomplete.status).toBe(409);
    expect(incomplete.body.error.message).toMatch(/all are VERIFIED/);

    await verifyMilestone(client.token, contractor.token, milestoneId);
    const executionComplete = await transitionProject(client.token, projectId, "EXECUTION_COMPLETE");
    expect(executionComplete.status).toBe(200);
    const finalReview = await transitionProject(admin.token, projectId, "UNDER_FINAL_REVIEW");
    expect(finalReview.status).toBe(200);
    const completed = await transitionProject(client.token, projectId, "COMPLETED");
    expect(completed.status).toBe(200);
    expect(completed.body.data.project.lifecycleStatus).toBe("COMPLETED");

    const repeat = await transitionProject(client.token, projectId, "COMPLETED");
    expect(repeat.status).toBe(409);
    const historyResponse = await request(app)
      .get(`/api/v1/projects/${projectId}/lifecycle-history`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(historyResponse.status).toBe(200);
    expect(historyResponse.body.data.history.map((entry: { sequence: number }) => entry.sequence))
      .toEqual([0, 1, 2, 3, 4]);
    expect(historyResponse.body.data.history.map((entry: { newStatus: string }) => entry.newStatus))
      .toEqual(["CREATED", "IN_PROGRESS", "EXECUTION_COMPLETE", "UNDER_FINAL_REVIEW", "COMPLETED"]);
    expect(historyResponse.body.data.history.map((entry: { previousStatus: string | null }) => entry.previousStatus))
      .toEqual([null, "CREATED", "IN_PROGRESS", "EXECUTION_COMPLETE", "UNDER_FINAL_REVIEW"]);
    expect(historyResponse.body.data.history.at(-1)).toMatchObject({
      actorName: "Lifecycle Owner",
      actorRole: "CLIENT",
      isBaseline: false,
    });
    expect(historyResponse.body.data.history.at(-1)).not.toHaveProperty("actorId");
    expect(await prisma.projectStatusHistory.count({ where: { projectId } })).toBe(5);

    const forbiddenHistory = await request(app)
      .get(`/api/v1/projects/${projectId}/lifecycle-history`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(forbiddenHistory.status).toBe(403);

    const passport = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(passport.status).toBe(200);
    const passportProject = passport.body.contractorPassport.projects.find(
      (entry: { id: string }) => entry.id === projectId,
    );
    expect(passportProject).toMatchObject({
      lifecycleStatus: "COMPLETED",
      lifecycleHistory: [
        { newStatus: "CREATED", isBaseline: true },
        { newStatus: "IN_PROGRESS" },
        { newStatus: "EXECUTION_COMPLETE" },
        { newStatus: "UNDER_FINAL_REVIEW" },
        { newStatus: "COMPLETED" },
      ],
    });
    expect(passportProject.milestones[0].status).toBe("VERIFIED");
    expect(passportProject.milestones[0].statusHistory).toHaveLength(4);
    expect(passportProject.lifecycleHistory[0]).not.toHaveProperty("actorId");
  });

  it("requires at least one verified milestone before execution completion", async () => {
    const client = await registerClient("No Milestone Owner");
    const contractor = await registerContractor("No Milestone Contractor");
    const projectId = await createProject(client.token, contractor.contractorId);
    await transitionProject(contractor.token, projectId, "IN_PROGRESS");
    const noMilestones = await transitionProject(client.token, projectId, "EXECUTION_COMPLETE");
    expect(noMilestones.status).toBe(409);
  });

  it("retains project lifecycle snapshots after direct parent-row deletion", async () => {
    const client = await registerClient("Retained Lifecycle Owner");
    const contractor = await registerContractor("Retained Lifecycle Contractor");
    const projectId = await createProject(client.token, contractor.contractorId);
    const baseline = await prisma.projectStatusHistory.findFirstOrThrow({ where: { projectId } });

    await prisma.project.delete({ where: { id: projectId } });

    expect(await prisma.project.findUnique({ where: { id: projectId } })).toBeNull();
    expect(await prisma.projectStatusHistory.findUnique({ where: { id: baseline.id } }))
      .toMatchObject({ projectId, newStatus: "CREATED", isBaseline: true });
    await expect(prisma.projectStatusHistory.delete({ where: { id: baseline.id } }))
      .rejects.toThrow(/append-only/i);
  });
});
