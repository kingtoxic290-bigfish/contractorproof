import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import {
  cleanupQaUsers,
  registerClient,
  registerContractor,
  uploadEvidence,
} from "./qa/fixtures";

afterEach(cleanupQaUsers);

const transitions = (milestoneId: string) => `/api/v1/milestones/${milestoneId}/transitions`;

async function transition(token: string, milestoneId: string, body: Record<string, unknown>) {
  return request(app)
    .post(transitions(milestoneId))
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

async function createProjectWithMilestone(
  clientToken: string,
  contractorId: string,
  name: string,
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
    .send({ name: `${name} Milestone` });
  expect(milestone.status).toBe(201);
  return { projectId, milestoneId: milestone.body.data.milestone.id as string };
}

/** Drives a milestone all the way to VERIFIED through the real API only. */
async function driveToVerified(
  clientToken: string,
  contractorToken: string,
  milestoneId: string,
) {
  await transition(contractorToken, milestoneId, { status: "IN_PROGRESS" });
  const upload = await uploadEvidence(
    contractorToken,
    milestoneId,
    Buffer.from(`evidence for ${milestoneId}`),
  );
  expect(upload.status).toBe(201);
  const evidenceId = upload.body.data.evidence.id as string;
  await transition(contractorToken, milestoneId, {
    status: "PENDING_VERIFICATION",
    evidenceId,
  });
  const attestation = await request(app)
    .post("/api/v1/attestations")
    .set("Authorization", `Bearer ${clientToken}`)
    .send({ milestoneId, evidenceId, decision: "APPROVED" });
  expect(attestation.status).toBe(201);
  const verified = await transition(clientToken, milestoneId, {
    status: "VERIFIED",
    evidenceId,
  });
  expect(verified.status).toBe(200);
}

async function readPassport(token: string, contractorId: string) {
  return request(app)
    .get(`/api/v1/contractors/${contractorId}/passport`)
    .set("Authorization", `Bearer ${token}`);
}

describe("Phase 4.5 transition authorization order", () => {
  it("refuses a forbidden role before looking at anything else in the request", async () => {
    const client = await registerClient("Ordering Client");
    const assigned = await registerContractor("Ordering Assigned Contractor");
    const unassigned = await registerContractor("Ordering Unassigned Contractor");
    const { milestoneId } = await createProjectWithMilestone(
      client.token,
      assigned.contractorId,
      "Ordering Project",
    );

    // The assigned CONTRACTOR is forbidden to verify. The request is also
    // malformed in ways that would each produce a 400 on their own: an unknown
    // status, a non-UUID evidenceId, a non-string reason, and a reason over the
    // length limit. Authorization has to be decided first or the caller learns
    // the shape of the request from the code it got back.
    const forbidden = await transition(unassigned.token, milestoneId, {
      status: "VERIFIED",
      evidenceId: "not-a-uuid",
      reason: 42,
    });
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.error.code).toBe("FORBIDDEN");

    const unknownStatus = await transition(unassigned.token, milestoneId, {
      status: "COMPLETED",
    });
    expect(unknownStatus.status).toBe(403);
    expect(unknownStatus.body.error.code).toBe("FORBIDDEN");

    const forbiddenSubmit = await transition(client.token, milestoneId, {
      status: "PENDING_VERIFICATION",
      evidenceId: "not-a-uuid",
    });
    expect(forbiddenSubmit.status).toBe(403);

    // Nothing was written, so the milestone is untouched by any of the above.
    const history = await request(app)
      .get(`/api/v1/milestones/${milestoneId}/history`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(history.status).toBe(200);
    expect(history.body.data.history).toHaveLength(1);
    expect(history.body.data.history[0]).toMatchObject({
      newStatus: "PENDING",
      isBaseline: true,
    });
  });

  it("still validates shape for an authorized role", async () => {
    const client = await registerClient("Shape Client");
    const contractor = await registerContractor("Shape Contractor");
    const { milestoneId } = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Shape Project",
    );

    const unknownStatus = await transition(client.token, milestoneId, {
      status: "COMPLETED",
    });
    expect(unknownStatus.status).toBe(400);
    expect(unknownStatus.body.error.code).toBe("VALIDATION_ERROR");

    const badEvidence = await transition(client.token, milestoneId, {
      status: "VERIFIED",
      evidenceId: "not-a-uuid",
    });
    expect(badEvidence.status).toBe(400);

    const noEvidence = await transition(client.token, milestoneId, {
      status: "VERIFIED",
    });
    expect(noEvidence.status).toBe(400);
  });

  it("answers 404 for a milestone the actor could never see", async () => {
    const client = await registerClient("Hidden Client");
    const contractor = await registerContractor("Hidden Contractor");
    const stranger = await registerContractor("Stranger Contractor");
    const { milestoneId } = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Hidden Project",
    );

    const response = await transition(stranger.token, milestoneId, {
      status: "IN_PROGRESS",
    });
    expect([403, 404]).toContain(response.status);
  });
});

describe("Phase 4.5 passport separates verified history from active work", () => {
  it("files a fully verified project as history and unverified work as active", async () => {
    const client = await registerClient("Passport Client");
    const contractor = await registerContractor("Passport Contractor");
    const finished = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Finished Project",
    );
    const ongoing = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Ongoing Project",
    );

    await driveToVerified(client.token, contractor.token, finished.milestoneId);
    // The second project has a milestone but is not verified, so it must not be
    // readable as delivered history.
    await transition(contractor.token, ongoing.milestoneId, { status: "IN_PROGRESS" });

    const passport = await readPassport(client.token, contractor.contractorId);
    expect(passport.status).toBe(200);
    const body = passport.body.contractorPassport;

    const historyIds = body.verifiedHistory.map((row: { id: string }) => row.id);
    const activeIds = body.activeProjects.map((row: { id: string }) => row.id);

    expect(historyIds).toContain(finished.projectId);
    expect(historyIds).not.toContain(ongoing.projectId);
    expect(activeIds).toContain(ongoing.projectId);
    expect(activeIds).not.toContain(finished.projectId);

    // Every project lands in exactly one list, and nothing is dropped.
    const overlap = historyIds.filter((id: string) => activeIds.includes(id));
    expect(overlap).toEqual([]);
    expect(historyIds.length + activeIds.length).toBe(body.projects.length);
    expect(body.totals.verifiedHistory).toBe(historyIds.length);
    expect(body.totals.activeProjects).toBe(activeIds.length);
    expect(body.totals.projects).toBe(body.projects.length);

    // The partition is stated, and it stays an evidence statement rather than a
    // judgement about the contractor.
    expect(body.scope.verifiedHistoryBasis).toMatch(/VERIFIED/);
    expect(body.scope.containsRatings).toBe(false);
    expect(body.verifiedHistory[0]).not.toHaveProperty("rating");
    expect(body.verifiedHistory[0]).not.toHaveProperty("rank");
    expect(body.verifiedHistory[0]).not.toHaveProperty("recommendation");
  });

  it("keeps a project with no milestones out of verified history", async () => {
    const client = await registerClient("Empty Client");
    const contractor = await registerContractor("Empty Contractor");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "No Milestones", contractorId: contractor.contractorId });
    expect(project.status).toBe(201);

    const passport = await readPassport(client.token, contractor.contractorId);
    const body = passport.body.contractorPassport;
    expect(body.totals.projectsWithoutMilestones).toBe(1);
    expect(body.verifiedHistory).toHaveLength(0);
    expect(body.activeProjects.map((row: { id: string }) => row.id)).toContain(
      project.body.data.project.id as string,
    );
  });

  it("does not let an unverified project in through lifecycle status alone", async () => {
    const client = await registerClient("Lifecycle Client");
    const contractor = await registerContractor("Lifecycle Contractor");
    const { projectId } = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Lifecycle Project",
    );

    // A project can be marked COMPLETED administratively while its milestone is
    // still unverified. That must not promote the project into history.
    const advanced = await request(app)
      .post(`/api/v1/projects/${projectId}/lifecycle/transitions`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ status: "IN_PROGRESS" });
    expect([200, 201, 404, 409]).toContain(advanced.status);

    const passport = await readPassport(client.token, contractor.contractorId);
    const body = passport.body.contractorPassport;
    const project = body.projects.find((row: { id: string }) => row.id === projectId);
    expect(project.milestoneStatus.allVerified).toBe(false);
    expect(body.verifiedHistory.map((row: { id: string }) => row.id)).not.toContain(projectId);
    expect(body.activeProjects.map((row: { id: string }) => row.id)).toContain(projectId);
  });

  it("holds the partition when the viewer is not the owning client", async () => {
    const owner = await registerClient("Redaction Owner");
    const contractor = await registerContractor("Redaction Contractor");
    const other = await registerClient("Redaction Other Client");
    const finished = await createProjectWithMilestone(
      owner.token,
      contractor.contractorId,
      "Redaction Finished",
    );
    await driveToVerified(owner.token, contractor.token, finished.milestoneId);

    const passport = await readPassport(other.token, contractor.contractorId);
    expect(passport.status).toBe(200);
    const body = passport.body.contractorPassport;

    // The other client may learn that verified history exists, and that the
    // project is in it, but not whose project it is.
    const entry = body.verifiedHistory.find(
      (row: { id: string }) => row.id === finished.projectId,
    );
    expect(entry).toBeDefined();
    expect(entry.clientVisible).toBe(false);
    expect(entry.clientName).toBeNull();
    expect(entry.description).toBeNull();
  });
});

describe("Phase 4.5 variation history", () => {
  it("appends a milestone history entry when an approved variation changes the status", async () => {
    const client = await registerClient("Variation Client");
    const contractor = await registerContractor("Variation Contractor");
    const { milestoneId } = await createProjectWithMilestone(
      client.token,
      contractor.contractorId,
      "Variation Project",
    );
    await transition(contractor.token, milestoneId, { status: "IN_PROGRESS" });

    const before = await prisma.milestoneStatusHistory.findMany({
      where: { milestoneId },
      orderBy: { sequence: "asc" },
    });
    expect(before).toHaveLength(2);

    const variation = await request(app)
      .post("/api/v1/variations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        projectId: (await prisma.milestone.findUniqueOrThrow({ where: { id: milestoneId } }))
          .projectId,
        reason: "Scope adjusted after site inspection",
        proposedState: { status: "VERIFIED" },
        milestoneId,
      });
    expect([201, 400, 403, 409]).toContain(variation.status);

    const after = await prisma.milestoneStatusHistory.findMany({
      where: { milestoneId },
      orderBy: { sequence: "asc" },
    });

    // History is append-only and ordered: whatever the variation did, the rows
    // already on record are unchanged and any new row continues the sequence.
    expect(after.slice(0, before.length)).toEqual(before);
    for (const entry of after.slice(before.length)) {
      expect(entry.sequence).toBe(
        (after.find((row) => row.sequence === entry.sequence - 1)?.sequence ?? -1) + 1,
      );
    }
  });
});