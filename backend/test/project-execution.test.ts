import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
  uploadEvidence,
} from "./qa/fixtures";

/**
 * Phase 4.4 - Project execution / milestone performance.
 *
 * The loop under test:
 *
 *   CLIENT creates project -> CLIENT creates milestone -> CONTRACTOR submits
 *   progress and evidence -> CLIENT reviews -> milestone is approved or sent
 *   back -> history is preserved throughout.
 *
 * Two rules are asserted repeatedly because they are the ones a performance
 * feature most easily erodes:
 *
 *   - a CONTRACTOR may submit progress but may never record the client's
 *     review outcome, and
 *   - nothing is ever presented as a judgement about the contractor. A
 *     rejection, a correction and a dispute are separate recorded events, and
 *     no endpoint here returns a score, rank or verdict.
 */

const MILESTONE_TRANSITIONS = "/api/v1/milestones";

async function createProjectWithMilestone(
  client: { token: string },
  contractorId: string,
  name = "Execution Project",
) {
  const project = await request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${client.token}`)
    .send({ name, contractorId });
  expect(project.status).toBe(201);

  const milestone = await request(app)
    .post(`/api/v1/projects/${project.body.data.project.id}/milestones`)
    .set("Authorization", `Bearer ${client.token}`)
    .send({ name: "Deck pour" });
  expect(milestone.status).toBe(201);

  return {
    projectId: project.body.data.project.id as string,
    milestoneId: milestone.body.data.milestone.id as string,
  };
}

/** A blockchain event a correction or dispute can be raised against. */
async function seedAnchorEvent(projectId: string) {
  const event = await prisma.blockchainEvent.create({
    data: {
      projectId,
      eventType: BlockchainEventType.ATTESTATION,
      logicalKey: `${BlockchainEventType.ATTESTATION}:${projectId}:${projectId}`,
    },
  });
  return event.id;
}

async function historyOf(milestoneId: string) {
  return prisma.milestoneStatusHistory.findMany({
    where: { milestoneId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

describe("Phase 4.4 project execution", () => {
  afterEach(cleanupQaUsers);

  // 1. CLIENT can create milestones on their own project.
  it("lets the owning CLIENT create milestones on their own project", async () => {
    const client = await registerClient("Execution Milestone Client");
    const contractor = await registerContractor("Execution Milestone Contractor");
    const { projectId } = await createProjectWithMilestone(client, contractor.contractorId);

    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Second milestone" });

    expect(created.status).toBe(201);
    expect(created.body.data.milestone).toMatchObject({
      projectId,
      name: "Second milestone",
      status: "PENDING",
    });

    // The baseline transition is recorded when the milestone is created.
    const history = await historyOf(created.body.data.milestone.id as string);
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      previousStatus: null,
      newStatus: "PENDING",
      isBaseline: true,
    });
  });

  // 2. CONTRACTOR cannot create milestones.
  it("rejects a CONTRACTOR creating or reconfiguring a milestone", async () => {
    const client = await registerClient("Milestone Config Client");
    const contractor = await registerContractor("Milestone Config Contractor");
    const { projectId } = await createProjectWithMilestone(client, contractor.contractorId);

    const created = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ name: "Contractor milestone" });
    expect(created.status).toBe(403);

    const collection = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ projectId, name: "Contractor collection milestone" });
    expect(collection.status).toBe(403);
  });

  // 3 + 4. CONTRACTOR submits progress and evidence, but cannot approve.
  it("lets the assigned CONTRACTOR record progress and submit evidence without ever approving", async () => {
    const client = await registerClient("Progress Client");
    const contractor = await registerContractor("Progress Contractor");
    const stranger = await registerContractor("Unrelated Progress Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(
      client,
      contractor.contractorId,
    );

    const started = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "IN_PROGRESS", reason: "Site access granted" });
    expect(started.status).toBe(200);
    expect(started.body.data.milestone.status).toBe("IN_PROGRESS");

    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("phase-4-4"));
    expect(upload.status).toBe(201);
    const evidenceId = upload.body.data.evidence.id as string;

    const submitted = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "PENDING_VERIFICATION", evidenceId });
    expect(submitted.status).toBe(200);
    expect(submitted.body.data.milestone.status).toBe("PENDING_VERIFICATION");

    // A contractor cannot record the client's review outcome.
    for (const status of ["VERIFIED", "REJECTED"]) {
      const attempt = await request(app)
        .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
        .set("Authorization", `Bearer ${contractor.token}`)
        .send({ status, evidenceId });
      expect(attempt.status).toBe(403);
      expect(attempt.body.error.code).toBe("FORBIDDEN");
    }

    // Nor can a contractor attest evidence at all.
    const attest = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ milestoneId, evidenceId, decision: "APPROVED" });
    expect(attest.status).toBe(403);

    // Nor can an unrelated contractor touch another project's milestone.
    const foreign = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(foreign.status).toBe(403);
  });

  // 5. CLIENT can review their own project's milestone.
  it("lets the owning CLIENT approve a submitted milestone and preserves the whole sequence", async () => {
    const client = await registerClient("Reviewing Client");
    const contractor = await registerContractor("Reviewing Contractor");
    const { milestoneId } = await createProjectWithMilestone(client, contractor.contractorId);

    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "IN_PROGRESS" });
    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("review-me"));
    const evidenceId = upload.body.data.evidence.id as string;
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "PENDING_VERIFICATION", evidenceId });

    // Approval is a review decision, and it needs the attestation that records it.
    const premature = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "VERIFIED", evidenceId });
    expect(premature.status).toBe(409);

    const attestation = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ milestoneId, evidenceId, decision: "APPROVED", comment: "Reviewed the submission" });
    expect(attestation.status).toBe(201);
    assertNoSecrets(attestation.body);

    const approved = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "VERIFIED", evidenceId });
    expect(approved.status).toBe(200);
    expect(approved.body.data.milestone.status).toBe("VERIFIED");

    const history = await historyOf(milestoneId);
    expect(history.map((row) => row.newStatus)).toEqual([
      "PENDING",
      "IN_PROGRESS",
      "PENDING_VERIFICATION",
      "VERIFIED",
    ]);
    expect(history.map((row) => row.previousStatus)).toEqual([
      null,
      "PENDING",
      "IN_PROGRESS",
      "PENDING_VERIFICATION",
    ]);
    // Nothing in the audit trail characterises the contractor.
    const serialized = JSON.stringify(history);
    expect(serialized).not.toMatch(/trust|reputation|reliable|score|rating/i);
  });

  // 6. CLIENT cannot review another client's private project.
  it("denies a CLIENT access to another client's milestone execution", async () => {
    const owner = await registerClient("Executing Owner");
    const stranger = await registerClient("Executing Stranger");
    const contractor = await registerContractor("Executing Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(owner, contractor.contractorId);

    const detail = await request(app)
      .get(`${MILESTONE_TRANSITIONS}/${milestoneId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(detail.status).toBe(403);

    const history = await request(app)
      .get(`${MILESTONE_TRANSITIONS}/${milestoneId}/history`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(history.status).toBe(403);

    const transition = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(transition.status).toBe(403);
    expect(transition.body.error.code).toBe("FORBIDDEN");

    const list = await request(app)
      .get(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(list.status).toBe(403);
  });

  // 7. Unauthenticated callers are rejected.
  it("rejects unauthenticated milestone history and transition requests", async () => {
    const client = await registerClient("Unauthenticated Execution Client");
    const contractor = await registerContractor("Unauthenticated Execution Contractor");
    const { milestoneId } = await createProjectWithMilestone(client, contractor.contractorId);

    expect((await request(app).get(`${MILESTONE_TRANSITIONS}/${milestoneId}`)).status).toBe(401);
    expect(
      (await request(app).get(`${MILESTONE_TRANSITIONS}/${milestoneId}/history`)).status,
    ).toBe(401);
    expect(
      (await request(app)
        .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
        .send({ status: "IN_PROGRESS" })).status,
    ).toBe(401);
    expect(
      (await request(app)
        .post("/api/v1/attestations")
        .send({ milestoneId, evidenceId: milestoneId, decision: "APPROVED" })).status,
    ).toBe(401);
  });

  // 8. Correction workflow preserves the original submission.
  it("preserves the original submission when a correction is requested and resolved", async () => {
    const client = await registerClient("Correction Client");
    const contractor = await registerContractor("Correction Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(
      client,
      contractor.contractorId,
    );
    const originalEventId = await seedAnchorEvent(projectId);

    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("original-submission"));
    const evidenceId = upload.body.data.evidence.id as string;
    const originalHash = upload.body.data.evidence.sha256 as string;

    const correction = await request(app)
      .post("/api/v1/corrections")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ milestoneId, originalEventId, evidenceId, reason: "Photo does not show completion" });
    expect(correction.status).toBe(201);
    expect(correction.body.data.correction).toMatchObject({ milestoneId, status: "OPEN" });

    // The original evidence and its hash are untouched by the correction.
    const evidence = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { versions: true },
    });
    expect(evidence?.sha256).toBe(originalHash);
    expect(evidence?.versions).toHaveLength(1);

    const contractorSees = await request(app)
      .get(`/api/v1/corrections?milestoneId=${milestoneId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorSees.status).toBe(200);
    expect(contractorSees.body.data.corrections).toHaveLength(1);
    assertNoSecrets(contractorSees.body);

    // The client requests the correction; resolving it is an oversight action.
    const oversight = await privileged(Role.AUDITOR, "Correction Reviewer");
    const clientResolve = await request(app)
      .post(`/api/v1/corrections/${correction.body.data.correction.id}/resolve`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "APPROVED", resolution: "Client may not resolve" });
    expect(clientResolve.status).toBe(403);

    const underReview = await request(app)
      .post(`/api/v1/corrections/${correction.body.data.correction.id}/review`)
      .set("Authorization", `Bearer ${oversight.token}`)
      .send({});
    expect(underReview.status).toBe(200);

    const resolved = await request(app)
      .post(`/api/v1/corrections/${correction.body.data.correction.id}/resolve`)
      .set("Authorization", `Bearer ${oversight.token}`)
      .send({ status: "APPROVED", resolution: "Corrected submission accepted", correctedEvidenceVersionId: evidence.versions[0].id });
    expect(resolved.status).toBe(201);

    // History survives the resolution: the correction is still readable.
    const afterResolution = await request(app)
      .get(`/api/v1/corrections/${correction.body.data.correction.id}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(afterResolution.status).toBe(200);
    expect(afterResolution.body.data.correction.reason).toBe("Photo does not show completion");

    const evidenceAfter = await prisma.evidence.findUnique({
      where: { id: evidenceId },
      include: { versions: true },
    });
    expect(evidenceAfter?.versions).toHaveLength(1);
    expect(evidenceAfter?.versions[0].sha256).toBe(originalHash);
  });

  // 9. Dispute workflow preserves its own history, separately from approval.
  it("records a dispute as its own event and keeps it distinct from approval and correction", async () => {
    const client = await registerClient("Dispute Client");
    const contractor = await registerContractor("Dispute Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(
      client,
      contractor.contractorId,
    );
    const originalEventId = await seedAnchorEvent(projectId);

    const dispute = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ milestoneId, originalEventId, reason: "Delay was caused by a client-side change" });
    expect(dispute.status).toBe(201);
    const disputeId = dispute.body.data.dispute.id as string;
    expect(dispute.body.data.dispute.status).toBe("OPEN");
    assertNoSecrets(dispute.body);

    // The dispute does not change the milestone status on its own.
    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(milestone?.status).toBe("PENDING");
    expect(await historyOf(milestoneId)).toHaveLength(1);

    const reviewer = await privileged(Role.AUDITOR, "Dispute Reviewer");
    const underReview = await request(app)
      .post(`/api/v1/disputes/${disputeId}/review`)
      .set("Authorization", `Bearer ${reviewer.token}`)
      .send({});
    expect(underReview.status).toBe(200);

    const resolved = await request(app)
      .post(`/api/v1/disputes/${disputeId}/resolutions`)
      .set("Authorization", `Bearer ${reviewer.token}`)
      .send({ status: "RESOLVED", resolution: "Client-caused delay confirmed" });
    expect(resolved.status).toBe(201);

    const after = await request(app)
      .get(`/api/v1/disputes/${disputeId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(after.status).toBe(200);
    // Context is preserved rather than reinterpreted as contractor fault.
    expect(after.body.data.dispute.reason).toBe("Delay was caused by a client-side change");
    expect(after.body.data.dispute.resolutions).toHaveLength(1);
    expect(JSON.stringify(after.body)).not.toMatch(/at fault|blame|liable/i);
  });

  // 10. Evidence verification and 11. blockchain proofs still function.
  it("keeps evidence fingerprints and blockchain proofs intact through execution", async () => {
    const client = await registerClient("Proof Client");
    const contractor = await registerContractor("Proof Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(
      client,
      contractor.contractorId,
    );

    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("proof-bytes"));
    expect(upload.status).toBe(201);
    const evidenceId = upload.body.data.evidence.id as string;
    const sha256 = upload.body.data.evidence.sha256 as string;
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
    // Files never leave PostgreSQL and never enter the public payload.
    expect(JSON.stringify(upload.body)).not.toMatch(/storageKey|storageReference/i);

    const proof = await request(app)
      .get(`/api/v1/blockchain?projectId=${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(proof.status).toBe(200);
    expect(Array.isArray(proof.body.data.events)).toBe(true);
    assertNoSecrets(proof.body);
  });

  // 12. Passport aggregation still reflects the execution loop.
  it("feeds the contractor passport from the same milestone statuses", async () => {
    const client = await registerClient("Passport Client");
    const contractor = await registerContractor("Passport Contractor");
    const { projectId, milestoneId } = await createProjectWithMilestone(
      client,
      contractor.contractorId,
    );

    const before = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(before.status).toBe(200);
    const projectBefore = before.body.contractorPassport.projects.find(
      (row: { id: string }) => row.id === projectId,
    );
    expect(projectBefore.milestoneStatus.total).toBe(1);
    expect(projectBefore.milestoneStatus.allVerified).toBe(false);
    expect(before.body.contractorPassport.scope.containsRatings).toBe(false);

    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "IN_PROGRESS" });
    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("passport-bytes"));
    const evidenceId = upload.body.data.evidence.id as string;
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "PENDING_VERIFICATION", evidenceId });
    await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ milestoneId, evidenceId, decision: "APPROVED" });
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "VERIFIED", evidenceId });

    const after = await request(app)
      .get(`/api/v1/contractors/${contractor.contractorId}/passport`)
      .set("Authorization", `Bearer ${client.token}`);
    const projectAfter = after.body.contractorPassport.projects.find(
      (row: { id: string }) => row.id === projectId,
    );
    // The passport reads the one existing definition: every milestone VERIFIED.
    expect(projectAfter.milestoneStatus.allVerified).toBe(true);
    expect(after.body.contractorPassport.totals.projectsWithAllMilestonesVerified).toBe(1);
    expect(after.body.contractorPassport.scope.milestoneCompletionBasis).toMatch(/VERIFIED/);
    assertNoSecrets(after.body);
  });

  // Legal transitions only: the state machine cannot be jumped.
  it("rejects an illegal milestone transition", async () => {
    const client = await registerClient("Transition Guard Client");
    const contractor = await registerContractor("Transition Guard Contractor");
    const { milestoneId } = await createProjectWithMilestone(client, contractor.contractorId);

    const skipped = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "VERIFIED" });
    expect(skipped.status).toBe(400);

    const withoutEvidence = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "PENDING_VERIFICATION" });
    expect(withoutEvidence.status).toBe(400);

    const unknownStatus = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "COMPLETED" });
    expect(unknownStatus.status).toBe(400);

    // A completed milestone cannot be silently re-opened.
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "IN_PROGRESS" });
    const upload = await uploadEvidence(contractor.token, milestoneId, Buffer.from("final"));
    const evidenceId = upload.body.data.evidence.id as string;
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ status: "PENDING_VERIFICATION", evidenceId });
    await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ milestoneId, evidenceId, decision: "APPROVED" });
    await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "VERIFIED", evidenceId });

    const reopened = await request(app)
      .post(`${MILESTONE_TRANSITIONS}/${milestoneId}/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "IN_PROGRESS" });
    expect(reopened.status).toBe(409);

    // The full sequence is still readable after the rejection.
    expect((await historyOf(milestoneId)).map((row) => row.newStatus)).toEqual([
      "PENDING",
      "IN_PROGRESS",
      "PENDING_VERIFICATION",
      "VERIFIED",
    ]);
  });
});
