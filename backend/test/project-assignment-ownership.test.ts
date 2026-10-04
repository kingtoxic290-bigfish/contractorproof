import { Role } from "@prisma/client";
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
} from "./qa/fixtures";

/**
 * Phase 4.3 - Assignment & Project Ownership.
 *
 * The rule under test is one-directional and never reverses:
 *
 *   CLIENT creates and owns a project -> CONTRACTOR is assigned -> the
 *   contractor executes it.
 *
 * Every assertion below is made at the HTTP boundary, so hiding a control in
 * the UI is never what makes an operation succeed or fail.
 */

async function createClientProject(
  client: { token: string },
  contractorId: string,
  overrides: Record<string, unknown> = {},
) {
  return request(app)
    .post("/api/v1/projects")
    .set("Authorization", `Bearer ${client.token}`)
    .send({ name: "Owned Project", contractorId, ...overrides });
}

/**
 * The public project payload deliberately omits the raw client user id, so
 * ownership is proven against the persisted row rather than the response body.
 */
async function persistedProject(projectId: string) {
  return prisma.project.findUnique({ where: { id: projectId } });
}

describe("Phase 4.3 assignment and project ownership", () => {
  afterEach(cleanupQaUsers);

  // 1. CLIENT can create a project.
  it("lets a CLIENT create and own a project assigned to a discovered contractor", async () => {
    const client = await registerClient("Ownership Client");
    const contractor = await registerContractor("Ownership Contractor");

    const created = await createClientProject(client, contractor.contractorId, {
      description: "Road resurfacing package",
      nestContractReference: "QA-CONTRACT-4301",
      procuringEntity: "QA Procuring Entity",
      contractStartDate: "2026-01-01T00:00:00.000Z",
      contractEndDate: "2026-12-31T00:00:00.000Z",
    });

    expect(created.status).toBe(201);
    expect(created.body.data.project).toMatchObject({
      name: "Owned Project",
      clientName: "Ownership Client",
      contractorId: contractor.contractorId,
      contractorName: "Ownership Contractor",
      description: "Road resurfacing package",
      nestContractReference: "QA-CONTRACT-4301",
      procuringEntity: "QA Procuring Entity",
      contractStartDate: "2026-01-01T00:00:00.000Z",
      contractEndDate: "2026-12-31T00:00:00.000Z",
    });
    const projectId = created.body.data.project.id as string;
    const persisted = await persistedProject(projectId);
    expect(persisted?.clientId).toBe(client.userId);
    assertNoSecrets(created.body);
  });

  // 4. CLIENT can assign a contractor.
  it("lets the owning CLIENT assign a contractor and never accepts a clientId from the body", async () => {
    const client = await registerClient("Assigning Client");
    const stranger = await registerClient("Injected Client");
    const contractor = await registerContractor("Assignable Contractor");

    const created = await createClientProject(client, contractor.contractorId);
    expect(created.status).toBe(201);
    const projectId = created.body.data.project.id as string;

    const assigned = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ contractorId: contractor.contractorId, clientId: stranger.userId });

    expect(assigned.status).toBe(200);
    expect(assigned.body.data.project.contractorId).toBe(contractor.contractorId);
    // Ownership is derived from the authenticated caller, never from the body.
    expect(assigned.body.data.project).not.toHaveProperty("clientId");
    const persisted = await persistedProject(projectId);
    expect(persisted?.clientId).toBe(client.userId);
    expect(persisted?.clientId).not.toBe(stranger.userId);
    assertNoSecrets(assigned.body);
  });

  // 2 + 5. CONTRACTOR cannot create a project, including one that names them.
  it("rejects a CONTRACTOR creating a project, including a self-assigned one", async () => {
    const contractor = await registerContractor("Self Assigning Contractor");

    const selfAssigned = await createClientProject(contractor, contractor.contractorId);
    expect(selfAssigned.status).toBe(403);
    expect(selfAssigned.body.error.code).toBe("FORBIDDEN");

    const namingAnotherContractor = await registerContractor("Other Named Contractor");
    const assigningOther = await createClientProject(contractor, namingAnotherContractor.contractorId);
    expect(assigningOther.status).toBe(403);

    const claimingOwnership = await createClientProject(contractor, contractor.contractorId, {
      clientId: contractor.userId,
    });
    expect(claimingOwnership.status).toBe(403);

    const projects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(projects.body.projects).toEqual([]);
  });

  // 5 + 6. CONTRACTOR cannot assign themselves or change the assignment.
  it("rejects a CONTRACTOR assigning themselves or replacing the assigned contractor", async () => {
    const client = await registerClient("Immutable Assignment Client");
    const assigned = await registerContractor("Current Assignee");
    const replacement = await registerContractor("Replacement Candidate");

    const created = await createClientProject(client, assigned.contractorId);
    const projectId = created.body.data.project.id as string;

    const selfAssignment = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${assigned.token}`)
      .send({ contractorId: assigned.contractorId });
    expect(selfAssignment.status).toBe(403);

    const otherAssignment = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${replacement.token}`)
      .send({ contractorId: assigned.contractorId });
    expect(otherAssignment.status).toBe(403);

    const unchanged = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(unchanged.body.project.contractorId).toBe(assigned.contractorId);
    const persisted = await persistedProject(projectId);
    expect(persisted?.contractorId).toBe(assigned.contractorId);
    expect(persisted?.clientId).toBe(client.userId);
  });

  // 7 + 8. The assigned contractor sees it; nobody else does.
  it("shows an assigned project to its contractor and to nobody else", async () => {
    const client = await registerClient("Scoping Client");
    const otherClient = await registerClient("Other Scoping Client");
    const assigned = await registerContractor("Scoped Contractor");
    const unassigned = await registerContractor("Unscoped Contractor");

    const created = await createClientProject(client, assigned.contractorId, { name: "Scoped Project" });
    const projectId = created.body.data.project.id as string;

    const detail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${assigned.token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.project.id).toBe(projectId);
    assertNoSecrets(detail.body);

    const unassignedDetail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${unassigned.token}`);
    expect(unassignedDetail.status).toBe(403);

    const unassignedMilestones = await request(app)
      .get(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${unassigned.token}`);
    expect(unassignedMilestones.status).toBe(403);

    const assignedList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${assigned.token}`);
    expect(assignedList.body.projects.map((row: { id: string }) => row.id)).toEqual([projectId]);

    const unassignedList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${unassigned.token}`);
    expect(unassignedList.body.projects).toEqual([]);
  });

  it("removes the previous contractor from list and detail when the client reassigns", async () => {
    const client = await registerClient("Reassigning Client");
    const previous = await registerContractor("Previous Assignee");
    const next = await registerContractor("Next Assignee");

    const created = await createClientProject(client, previous.contractorId);
    const projectId = created.body.data.project.id as string;

    const reassigned = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ contractorId: next.contractorId });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.project.contractorId).toBe(next.contractorId);
    const persisted = await persistedProject(projectId);
    expect(persisted?.contractorId).toBe(next.contractorId);
    // Reassignment moves the contractor only; the owning client is unchanged.
    expect(persisted?.clientId).toBe(client.userId);

    const previousDetail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${previous.token}`);
    expect(previousDetail.status).toBe(403);

    const previousList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${previous.token}`);
    expect(previousList.body.projects).toEqual([]);

    const nextList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${next.token}`);
    expect(nextList.body.projects.map((row: { id: string }) => row.id)).toEqual([projectId]);
  });

  // 9 + 10. CLIENT scoping in both directions.
  it("scopes CLIENT project visibility to the projects they own", async () => {
    const owner = await registerClient("Owning Client");
    const stranger = await registerClient("Non Owning Client");
    const contractor = await registerContractor("Client Scoping Contractor");

    const created = await createClientProject(owner, contractor.contractorId);
    const projectId = created.body.data.project.id as string;

    const ownDetail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownDetail.status).toBe(200);

    const foreignDetail = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(foreignDetail.status).toBe(403);

    const ownList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownList.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);

    const foreignList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(foreignList.body.projects).toEqual([]);

    const foreignReassign = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ contractorId: contractor.contractorId });
    expect(foreignReassign.status).toBe(403);
  });

  // 3. ADMIN keeps its administrative capabilities.
  it("keeps ADMIN creation, assignment, and read capabilities", async () => {
    const admin = await privileged(Role.ADMIN, "Phase 4.3 Admin");
    const contractor = await registerContractor("Admin Assigned Contractor");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Admin Project", contractorId: contractor.contractorId });
    expect(created.status).toBe(201);
    const projectId = created.body.data.project.id as string;
    // ADMIN administers projects but does not become the owning client.
    const persisted = await persistedProject(projectId);
    expect(persisted?.clientId).toBeNull();

    const read = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(read.status).toBe(200);

    const contractorSeeProject = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorSeeProject.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);
  });

  // Oversight roles keep read-only project behaviour and gain no write access.
  it.each([Role.AUDITOR, Role.PROCUREMENT_OFFICER, Role.CONSULTANT_ENGINEER])(
    "does not let %s create or assign a project",
    async (role) => {
      const reviewer = await privileged(role, `Phase 4.3 ${role}`);
      const contractor = await registerContractor("Oversight Target Contractor");

      const created = await request(app)
        .post("/api/v1/projects")
        .set("Authorization", `Bearer ${reviewer.token}`)
        .send({ name: "Oversight Project", contractorId: contractor.contractorId });
      expect(created.status).toBe(403);
      expect(created.body.error.code).toBe("FORBIDDEN");

      const client = await registerClient("Oversight Project Owner");
      const owned = await createClientProject(client, contractor.contractorId);
      const projectId = owned.body.data.project.id as string;

      const reassigned = await request(app)
        .patch(`/api/v1/projects/${projectId}/contractor`)
        .set("Authorization", `Bearer ${reviewer.token}`)
        .send({ contractorId: contractor.contractorId });
      expect(reassigned.status).toBe(403);

      const milestone = await request(app)
        .post(`/api/v1/projects/${projectId}/milestones`)
        .set("Authorization", `Bearer ${reviewer.token}`)
        .send({ name: "Oversight Milestone" });
      expect(milestone.status).toBe(403);
    },
  );

  // 11. Unauthenticated requests are rejected before any ownership logic runs.
  it("rejects unauthenticated project creation, assignment, and reads", async () => {
    const contractor = await registerContractor("Unauthenticated Target");
    const client = await registerClient("Unauthenticated Owner");
    const created = await createClientProject(client, contractor.contractorId);
    const projectId = created.body.data.project.id as string;

    const create = await request(app)
      .post("/api/v1/projects")
      .send({ name: "Anonymous", contractorId: contractor.contractorId });
    expect(create.status).toBe(401);

    const assign = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .send({ contractorId: contractor.contractorId });
    expect(assign.status).toBe(401);

    const list = await request(app).get("/api/v1/projects");
    expect(list.status).toBe(401);

    const detail = await request(app).get(`/api/v1/projects/${projectId}`);
    expect(detail.status).toBe(401);
  });

  // 12. Milestone configuration and execution stay with their existing owners.
  it("keeps milestone configuration with the client and milestone execution with the contractor", async () => {
    const client = await registerClient("Milestone Ownership Client");
    const contractor = await registerContractor("Milestone Execution Contractor");
    const created = await createClientProject(client, contractor.contractorId);
    const projectId = created.body.data.project.id as string;

    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Phase 4.3 Milestone" });
    expect(milestone.status).toBe(201);
    const milestoneId = milestone.body.data.milestone.id as string;

    const contractorMilestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ name: "Contractor Configured Milestone" });
    expect(contractorMilestone.status).toBe(403);

    const contractorReads = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorReads.status).toBe(200);
  });

  // The assignment view identifies the contractor the CLIENT selected.
  it("exposes the assigned contractor CRB registration number on the project record", async () => {
    const client = await registerClient("Identity Client");
    const contractor = await registerContractor("Identity Contractor");
    const registrationNumber = `QA-CRB-${Date.now()}`;
    await prisma.contractor.update({
      where: { id: contractor.contractorId },
      data: { crbRegistrationNumber: registrationNumber },
    });

    const created = await createClientProject(client, contractor.contractorId);
    expect(created.status).toBe(201);
    expect(created.body.data.project.contractorCrbRegistrationNumber).toBe(registrationNumber);

    const detail = await request(app)
      .get(`/api/v1/projects/${created.body.data.project.id as string}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(detail.body.project.contractorCrbRegistrationNumber).toBe(registrationNumber);
  });

  it("reports a null CRB registration number instead of inventing one", async () => {
    const client = await registerClient("No Identity Client");
    const contractor = await registerContractor("No Identity Contractor");
    expect(contractor.contractorId).toEqual(expect.any(String));

    const created = await createClientProject(client, contractor.contractorId);
    expect(created.status).toBe(201);
    expect(created.body.data.project.contractorCrbRegistrationNumber).toBeNull();
  });
});
