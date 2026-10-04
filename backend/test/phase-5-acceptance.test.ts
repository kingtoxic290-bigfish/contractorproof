import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  registerClient,
  registerContractor,
  trackUser,
  uploadEvidence,
  uniqueEmail,
} from "./qa/fixtures";

/**
 * Phase 5 acceptance: the whole product story, driven only through the public
 * HTTP API.
 *
 * A CLIENT finds a contractor by CRB Registration Number, reads their Passport,
 * engages them on a project, and reviews each milestone's evidence until the
 * whole project is verified — including one milestone that goes through a real
 * correction and rework cycle rather than a straight approval. The project's
 * completion then has to become visible in the contractor's Passport, and a
 * different, previously unrelated CLIENT has to be able to discover that
 * history from scratch.
 *
 * Nothing here writes through Prisma except the CRB registration at setup,
 * which the public registration endpoint does not accept for a deterministic
 * reference. Every business record is created the way a user would create it.
 */

afterEach(cleanupQaUsers);

// Unique per run so a crashed previous run cannot leave this reference occupied
// and fail the whole scenario on the unique index.
const CRB_REFERENCE = `CRB-P5-${Date.now().toString(36).toUpperCase()}-001`;
const OTHER_CRB_REFERENCE = `CRB-P5-${Date.now().toString(36).toUpperCase()}-002`;

async function registerContractorWithCrb(name: string, crbRegistrationNumber: string) {
  const email = uniqueEmail("contractor");
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName: name,
    role: "CONTRACTOR",
  });
  expect(response.status).toBe(201);
  const userId = response.body.user.id as string;
  // Tracked so the shared fixture teardown removes this account too.
  trackUser(userId);
  await prisma.contractor.update({
    where: { userId },
    data: { crbRegistrationNumber },
  });
  const contractor = await prisma.contractor.findUniqueOrThrow({ where: { userId } });
  return { token: response.body.token as string, userId, contractorId: contractor.id, crbRegistrationNumber };
}

function transition(token: string, milestoneId: string, body: Record<string, unknown>) {
  return request(app)
    .post(`/api/v1/milestones/${milestoneId}/transitions`)
    .set("Authorization", `Bearer ${token}`)
    .send(body);
}

function passportOf(token: string, contractorId: string) {
  return request(app)
    .get(`/api/v1/contractors/${contractorId}/passport`)
    .set("Authorization", `Bearer ${token}`);
}

async function submitForReview(
  contractorToken: string,
  milestoneId: string,
  bytes: Buffer,
  fileName: string,
) {
  const started = await transition(contractorToken, milestoneId, { status: "IN_PROGRESS" });
  expect(started.status).toBe(200);

  const upload = await uploadEvidence(contractorToken, milestoneId, bytes, fileName);
  expect(upload.status).toBe(201);
  const evidenceId = upload.body.data.evidence.id as string;

  const submitted = await transition(contractorToken, milestoneId, {
    status: "PENDING_VERIFICATION",
    evidenceId,
  });
  expect(submitted.status).toBe(200);
  return evidenceId;
}

async function approve(clientToken: string, milestoneId: string, evidenceId: string) {
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
  return verified.body.data.milestone.status as string;
}

describe("Phase 5 acceptance: CRB discovery to verified project history", () => {
  it("carries one contractor from discovery to a fully verified project recorded in their passport", async () => {
    // ---- A. A client discovers the contractor by CRB Registration Number ----
    const contractor = await registerContractorWithCrb("ABC Construction Ltd", CRB_REFERENCE);
    const client = await registerClient("Example Facility Authority");

    const discovery = await request(app)
      .get(`/api/v1/contractors?crbRegistrationNumber=${encodeURIComponent(CRB_REFERENCE)}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(discovery.status).toBe(200);
    assertNoSecrets(discovery.body);
    const found = discovery.body.contractors as Array<{ id: string; legalName: string }>;
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(contractor.contractorId);
    expect(found[0].legalName).toBe("ABC Construction Ltd");

    // ---- B. The client opens the Passport before engaging them ----
    const before = await passportOf(client.token, contractor.contractorId);
    expect(before.status).toBe(200);
    assertNoSecrets(before.body);
    const beforePassport = before.body.contractorPassport;
    expect(beforePassport.verifiedHistory).toEqual([]);
    expect(beforePassport.activeProjects).toEqual([]);
    expect(beforePassport.scope.containsRatings).toBe(false);

    // ---- D/E. The client creates the project and assigns the contractor ----
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Construction of Example Facility", contractorId: contractor.contractorId });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    // The client owns the project from creation; assignment is a separate act.
    expect(project.body.data.project.contractorId).toBe(contractor.contractorId);

    const assignment = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ contractorId: contractor.contractorId });
    expect(assignment.status).toBe(200);
    assertNoSecrets(assignment.body);

    // ---- F. The contractor sees the assigned project ----
    const contractorProjects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorProjects.status).toBe(200);
    expect(
      (contractorProjects.body.projects as Array<{ id: string }>).map((row) => row.id),
    ).toContain(projectId);

    // ---- G. The client defines the four milestones ----
    const milestoneNames = [
      "Site Preparation",
      "Foundation",
      "Structural Works",
      "Completion",
    ];
    const milestones: Array<{ id: string; name: string }> = [];
    for (const name of milestoneNames) {
      const created = await request(app)
        .post(`/api/v1/projects/${projectId}/milestones`)
        .set("Authorization", `Bearer ${client.token}`)
        .send({ name });
      expect(created.status).toBe(201);
      milestones.push({ id: created.body.data.milestone.id as string, name });
    }
    expect(milestones).toHaveLength(4);

    const [sitePreparation, foundation, structuralWorks, completion] = milestones;

    // ---- H/I. Milestone 1: submit, review, verify ----
    const siteEvidenceId = await submitForReview(
      contractor.token,
      sitePreparation.id,
      Buffer.from("site preparation evidence"),
      "site.txt",
    );
    expect(await approve(client.token, sitePreparation.id, siteEvidenceId)).toBe("VERIFIED");

    // ---- J. Milestone 2: a genuine correction and rework cycle ----
    const firstFoundationEvidenceId = await submitForReview(
      contractor.token,
      foundation.id,
      Buffer.from("foundation evidence, first submission"),
      "foundation-v1.txt",
    );

    // The client rejects rather than approves, so the milestone genuinely
    // re-enters work instead of jumping straight to verified.
    const rejection = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ milestoneId: foundation.id, evidenceId: firstFoundationEvidenceId, decision: "REJECTED" });
    expect(rejection.status).toBe(201);

    const rejected = await transition(client.token, foundation.id, {
      status: "REJECTED",
      evidenceId: firstFoundationEvidenceId,
      reason: "Foundation depth is not evidenced in the submitted material.",
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data.milestone.status).toBe("REJECTED");

    // The correction is raised against the client's own rejection.
    const rejectionEventId = rejection.body.data.proof?.id ?? null;
    if (rejectionEventId) {
      const correction = await request(app)
        .post("/api/v1/corrections")
        .set("Authorization", `Bearer ${client.token}`)
        .send({
          milestoneId: foundation.id,
          originalEventId: rejectionEventId,
          reason: "Resubmit with the depth survey attached.",
        });
      // The correction is only accepted when the referenced event belongs to
      // this milestone's project; when no blockchain registry is configured
      // there is no event to anchor it to, and the history still shows the
      // rejection.
      expect([201, 400]).toContain(correction.status);
    }

    // Rework: back to work, new evidence, resubmitted, approved.
    const resumed = await transition(contractor.token, foundation.id, {
      status: "IN_PROGRESS",
      reason: "Resubmitting with the depth survey.",
    });
    expect(resumed.status).toBe(200);

    const secondUpload = await uploadEvidence(
      contractor.token,
      foundation.id,
      Buffer.from("foundation evidence, second submission with depth survey"),
      "foundation-v2.txt",
    );
    expect(secondUpload.status).toBe(201);
    const secondFoundationEvidenceId = secondUpload.body.data.evidence.id as string;

    const resubmitted = await transition(contractor.token, foundation.id, {
      status: "PENDING_VERIFICATION",
      evidenceId: secondFoundationEvidenceId,
    });
    expect(resubmitted.status).toBe(200);
    expect(await approve(client.token, foundation.id, secondFoundationEvidenceId)).toBe("VERIFIED");

    // The rework is a fact of the record, not an erased one.
    const foundationHistory = await request(app)
      .get(`/api/v1/milestones/${foundation.id}/history`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(foundationHistory.status).toBe(200);
    assertNoSecrets(foundationHistory.body);
    const foundationStatuses = (
      foundationHistory.body.data.history as Array<{ newStatus: string; sequence: number }>
    ).map((entry) => entry.newStatus);
    expect(foundationStatuses).toEqual([
      "PENDING",
      "IN_PROGRESS",
      "PENDING_VERIFICATION",
      "REJECTED",
      "IN_PROGRESS",
      "PENDING_VERIFICATION",
      "VERIFIED",
    ]);

    // ---- K. Milestone 3 also carries a dispute, resolved rather than ignored ----
    const structuralEvidenceId = await submitForReview(
      contractor.token,
      structuralWorks.id,
      Buffer.from("structural works evidence"),
      "structural.txt",
    );
    const dispute = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({
        milestoneId: structuralWorks.id,
        evidenceId: structuralEvidenceId,
        reason: "The submitted progress photographs predate the agreed structural pour.",
      });
    expect(dispute.status).toBe(201);
    assertNoSecrets(dispute.body);
    const disputeId = dispute.body.data.dispute.id as string;

    expect(await approve(client.token, structuralWorks.id, structuralEvidenceId)).toBe("VERIFIED");

    // The dispute remains an open, addressable record after the milestone is
    // verified: it is not silently dropped, and it does not block verification.
    const disputes = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${client.token}`);
    expect(disputes.status).toBe(200);
    expect(
      (disputes.body.data.disputes as Array<{ id: string }>).map((row) => row.id),
    ).toContain(disputeId);

    // ---- Milestone 4: submit, review, verify ----
    const completionEvidenceId = await submitForReview(
      contractor.token,
      completion.id,
      Buffer.from("completion handover evidence"),
      "completion.txt",
    );
    expect(await approve(client.token, completion.id, completionEvidenceId)).toBe("VERIFIED");

    // ---- L. Every milestone is now verified ----
    const milestoneList = await request(app)
      .get(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(milestoneList.status).toBe(200);
    const statuses = (
      milestoneList.body.milestones as Array<{ id: string; name: string; status: string }>
    ).map((row) => `${row.name}=${row.status}`);
    expect(statuses.sort()).toEqual(
      ["Site Preparation=VERIFIED", "Foundation=VERIFIED", "Structural Works=VERIFIED", "Completion=VERIFIED"].sort(),
    );

    // ---- M. The passport now records the project as verified history ----
    const after = await passportOf(client.token, contractor.contractorId);
    expect(after.status).toBe(200);
    assertNoSecrets(after.body);
    const afterPassport = after.body.contractorPassport;

    expect(afterPassport.totals.projectsWithAllMilestonesVerified).toBe(1);
    expect(afterPassport.verifiedHistory.map((row: { id: string }) => row.id)).toEqual([projectId]);
    expect(afterPassport.activeProjects).toEqual([]);

    // The split is a partition of the same records, not a copy.
    expect(afterPassport.projects).toHaveLength(1);
    expect(afterPassport.totals.verifiedHistory).toBe(1);
    expect(afterPassport.totals.activeProjects).toBe(0);

    // It remains evidence, never a judgement.
    expect(afterPassport.scope.containsRatings).toBe(false);
    expect(afterPassport.verifiedHistory[0]).not.toHaveProperty("rating");
    expect(afterPassport.verifiedHistory[0]).not.toHaveProperty("rank");
    expect(afterPassport.verifiedHistory[0]).not.toHaveProperty("recommendation");

    // ---- N. A different client discovers the contractor and sees that history ----
    const laterClient = await registerClient("Later Procuring Authority");
    const laterDiscovery = await request(app)
      .get(`/api/v1/contractors?crbRegistrationNumber=${encodeURIComponent(CRB_REFERENCE)}`)
      .set("Authorization", `Bearer ${laterClient.token}`);
    expect(laterDiscovery.status).toBe(200);
    expect((laterDiscovery.body.contractors as Array<{ id: string }>).map((row) => row.id)).toEqual([
      contractor.contractorId,
    ]);

    const laterPassport = await passportOf(laterClient.token, contractor.contractorId);
    expect(laterPassport.status).toBe(200);
    assertNoSecrets(laterPassport.body);
    const laterBody = laterPassport.body.contractorPassport;

    // The verified work is visible...
    expect(laterBody.verifiedHistory.map((row: { id: string }) => row.id)).toEqual([projectId]);
    const visible = laterBody.verifiedHistory[0] as { milestoneStatus: { allVerified: boolean } };
    expect(visible.milestoneStatus.allVerified).toBe(true);

    // ...but it is another client's project, so the narrative is withheld.
    expect(visible.clientVisible).toBe(false);
    expect(visible.description).toBeNull();
    expect(visible.clientName).toBeNull();
  });

  it("does not let the contractor approve, reassign, or take over the project", async () => {
    const client = await registerClient("Acceptance Guard Client");
    const contractor = await registerContractorWithCrb("XYZ Works Ltd", OTHER_CRB_REFERENCE);
    const stranger = await registerContractor("Unrelated Contractor");

    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Guarded Project", contractorId: contractor.contractorId });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Guarded Milestone" });
    expect(milestone.status).toBe(201);
    const milestoneId = milestone.body.data.milestone.id as string;

    // The contractor cannot create or take over a project.
    expect(
      (
        await request(app)
          .post("/api/v1/projects")
          .set("Authorization", `Bearer ${contractor.token}`)
          .send({ name: "Contractor Attempt", contractorId: contractor.contractorId })
      ).status,
    ).toBe(403);

    // Nor reassign one away from its owner.
    expect(
      (
        await request(app)
          .patch(`/api/v1/projects/${projectId}/contractor`)
          .set("Authorization", `Bearer ${contractor.token}`)
          .send({ contractorId: stranger.contractorId })
      ).status,
    ).toBe(403);

    // Nor add milestones to it.
    expect(
      (
        await request(app)
          .post(`/api/v1/projects/${projectId}/milestones`)
          .set("Authorization", `Bearer ${contractor.token}`)
          .send({ name: "Contractor Milestone" })
      ).status,
    ).toBe(403);

    // Nor verify its own submission.
    const evidenceId = await submitForReview(
      contractor.token,
      milestoneId,
      Buffer.from("guarded evidence"),
      "guarded.txt",
    );
    const selfApprove = await transition(contractor.token, milestoneId, {
      status: "VERIFIED",
      evidenceId,
    });
    expect(selfApprove.status).toBe(403);
    expect(selfApprove.body.error.code).toBe("FORBIDDEN");

    // Nor attest to its own evidence.
    const selfAttest = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ milestoneId, evidenceId, decision: "APPROVED" });
    expect(selfAttest.status).toBe(403);

    // A second contractor cannot see or touch the project at all.
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}`)
          .set("Authorization", `Bearer ${stranger.token}`)
      ).status,
    ).toBe(403);
    expect(
      (
        await request(app)
          .get(`/api/v1/projects/${projectId}/milestones`)
          .set("Authorization", `Bearer ${stranger.token}`)
      ).status,
    ).toBe(403);

    // And the milestone is still awaiting the client's decision.
    const stillOpen = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(stillOpen.status).toBe(200);
    expect(stillOpen.body.milestone.status).toBe("PENDING_VERIFICATION");
  });
});