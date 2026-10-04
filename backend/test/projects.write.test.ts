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

describe("POST /api/v1/projects and POST /api/v1/milestones", () => {
  afterEach(cleanupQaUsers);

  it("creates a client-owned project and assigns only a real selected contractor", async () => {
    const client = await registerClient("Project Client");
    const owner = await registerContractor("Assigned Contractor");
    const other = await registerContractor("Other Contractor");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        name: "Owned Project",
        description: "created over HTTP",
        contractorId: owner.contractorId,
        clientId: other.userId,
      });

    expect(created.status).toBe(201);
    expect(created.body.data.project).toMatchObject({
      name: "Owned Project",
      description: "created over HTTP",
      clientName: "Project Client",
      contractorId: owner.contractorId,
      contractorName: "Assigned Contractor",
    });
    expect(created.body.data.project.contractorId).not.toBe(other.contractorId);
    expect(created.body.data.project).not.toHaveProperty("clientId");
    expect(created.body.data.project.id).toEqual(expect.any(String));
    const persisted = await prisma.project.findUnique({ where: { id: created.body.data.project.id } });
    expect(persisted?.clientId).toBe(client.userId);
    expect(persisted?.clientId).not.toBe(other.userId);
  });

  it("returns 401 without a JWT and 400 when name is missing", async () => {
    const owner = await registerClient("Validation Owner");

    const unauthenticated = await request(app).post("/api/v1/projects").send({ name: "X" });
    expect(unauthenticated.status).toBe(401);

    const missingName = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forbids a contractor from creating or self-assigning a project", async () => {
    const contractor = await registerContractor("Forbidden Project Creator");
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`)
      .send({ name: "Forbidden Project", contractorId: contractor.contractorId });
    expect(response.status).toBe(403);
  });

  it("requires a valid assigned contractor for a client-owned project", async () => {
    const client = await registerClient("Missing Assignment Client");
    const missing = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "No Contractor" });
    expect(missing.status).toBe(400);
    expect(missing.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects a Contractor row whose linked user is not a CONTRACTOR", async () => {
    const client = await registerClient("Invalid Contractor Record Owner");
    const invalidContractor = await prisma.contractor.create({
      data: { userId: client.userId, legalName: "Invalid Contractor Profile" },
    });

    const response = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Invalid Assignment", contractorId: invalidContractor.id });

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("CONTRACTOR_NOT_FOUND");
  });

  it("lets only the owning client reassign the contractor and transfers project access", async () => {
    const client = await registerClient("Assignment Owner");
    const unrelatedClient = await registerClient("Unrelated Assignment Owner");
    const originalContractor = await registerContractor("Original Assignee");
    const replacementContractor = await registerContractor("Replacement Assignee");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Assignable Project", contractorId: originalContractor.contractorId });
    const projectId = project.body.data.project.id as string;

    const contractorAttempt = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${originalContractor.token}`)
      .send({ contractorId: replacementContractor.contractorId });
    expect(contractorAttempt.status).toBe(403);

    const unrelatedClientAttempt = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${unrelatedClient.token}`)
      .send({ contractorId: replacementContractor.contractorId });
    expect(unrelatedClientAttempt.status).toBe(403);

    const reassigned = await request(app)
      .patch(`/api/v1/projects/${projectId}/contractor`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ contractorId: replacementContractor.contractorId, clientId: unrelatedClient.userId });
    expect(reassigned.status).toBe(200);
    expect(reassigned.body.data.project).toMatchObject({
      id: projectId,
      contractorId: replacementContractor.contractorId,
      contractorName: "Replacement Assignee",
    });
    expect(reassigned.body.data.project).not.toHaveProperty("clientId");
    const persisted = await prisma.project.findUnique({ where: { id: projectId } });
    expect(persisted?.clientId).toBe(client.userId);

    const originalAccess = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${originalContractor.token}`);
    expect(originalAccess.status).toBe(403);
    const replacementAccess = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${replacementContractor.token}`);
    expect(replacementAccess.status).toBe(200);
  });

  it("lets ADMIN create a project for a contractor and rejects a missing contractorId", async () => {
    const owner = await registerContractor("Admin Target");
    const admin = await privileged(Role.ADMIN, "Project Admin");

    const missing = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Admin Project" });
    expect(missing.status).toBe(400);

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({ name: "Admin Project", contractorId: owner.contractorId });
    expect(created.status).toBe(201);
    expect(created.body.data.project.contractorId).toBe(owner.contractorId);
  });

  it("lets the owning client configure milestones and forbids contractor configuration", async () => {
    const owner = await registerContractor("Assigned Milestone Contractor");
    const client = await registerClient("Milestone Owner");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Milestone Project", contractorId: owner.contractorId });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    const nested = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Foundation", description: "first package" });
    expect(nested.status).toBe(201);
    expect(nested.body.data.milestone).toMatchObject({
      projectId,
      name: "Foundation",
      description: "first package",
      status: "PENDING",
    });

    const collection = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ projectId, name: "Structure" });
    expect(collection.status).toBe(201);
    expect(collection.body.data.milestone.projectId).toBe(projectId);
    expect(collection.body.data.milestone.name).toBe("Structure");

    const contractorAttempt = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Contractor Configured Milestone" });
    expect(contractorAttempt.status).toBe(403);
  });

  it("lets the assigned contractor submit evidence and only the owning client review it", async () => {
    const assigned = await registerContractor("Evidence Assigned Contractor");
    const unrelated = await registerContractor("Evidence Unrelated Contractor");
    const client = await registerClient("Evidence Project Client");
    const unrelatedClient = await registerClient("Unrelated Evidence Client");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Evidence Project", contractorId: assigned.contractorId });
    const projectId = project.body.data.project.id as string;
    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Submitted Work" });
    const milestoneId = milestone.body.data.milestone.id as string;

    const upload = await uploadEvidence(assigned.token, milestoneId, Buffer.from("assigned evidence"), "work.txt");
    expect(upload.status).toBe(201);
    const evidenceId = upload.body.data.evidence.id as string;

    const clientEvidence = await request(app)
      .get(`/api/v1/evidence?projectId=${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientEvidence.status).toBe(200);
    expect(clientEvidence.body.data.evidence.map((record: { id: string }) => record.id)).toContain(evidenceId);

    const unrelatedEvidence = await request(app)
      .get(`/api/v1/evidence?projectId=${projectId}`)
      .set("Authorization", `Bearer ${unrelatedClient.token}`);
    expect(unrelatedEvidence.status).toBe(200);
    expect(unrelatedEvidence.body.data.evidence).toEqual([]);

    const unrelatedProjectRead = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${unrelated.token}`);
    expect(unrelatedProjectRead.status).toBe(403);
  });

  it("returns 400 when milestone name or projectId is missing", async () => {
    const owner = await registerContractor("Milestone Validation Contractor");
    const client = await registerClient("Milestone Validation Client");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Validation Project", contractorId: owner.contractorId });
    const projectId = project.body.data.project.id as string;

    const missingName = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ projectId });
    expect(missingName.status).toBe(400);

    const missingProject = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Orphan" });
    expect(missingProject.status).toBe(400);
  });
});

describe("project and milestone ownership / IDOR", () => {
  afterEach(cleanupQaUsers);

  it("scopes project access to the owning client and assigned contractor and denies unrelated IDs", async () => {
    const contractor = await registerContractor("Assigned Contractor A");
    const unrelatedContractor = await registerContractor("Assigned Contractor B");
    const client = await registerClient("Owner A");
    const stranger = await registerClient("Owner B");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Project A", contractorId: contractor.contractorId });
    expect(created.status).toBe(201);
    const projectId = created.body.data.project.id as string;
    const foreignCreated = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ name: "Project B", contractorId: unrelatedContractor.contractorId });
    expect(foreignCreated.status).toBe(201);
    const foreignProjectId = foreignCreated.body.data.project.id as string;

    const ownProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(ownProject.status).toBe(200);
    expect(ownProject.body.project.id).toBe(projectId);

    const assignedProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(assignedProject.status).toBe(200);

    const foreignProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(foreignProject.status).toBe(403);

    const unrelatedContractorProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${unrelatedContractor.token}`);
    expect(unrelatedContractorProject.status).toBe(403);

    const contractorCannotReadForeignProject = await request(app)
      .get(`/api/v1/projects/${foreignProjectId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorCannotReadForeignProject.status).toBe(403);
    const clientCannotReadForeignProject = await request(app)
      .get(`/api/v1/projects/${foreignProjectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientCannotReadForeignProject.status).toBe(403);

    const createdMilestone = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ projectId, name: "Milestone A" });
    expect(createdMilestone.status).toBe(201);
    const milestoneId = createdMilestone.body.data.milestone.id as string;

    const ownMilestone = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(ownMilestone.status).toBe(200);
    expect(ownMilestone.body.milestone.id).toBe(milestoneId);

    const foreignMilestone = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${unrelatedContractor.token}`);
    expect(foreignMilestone.status).toBe(403);

    const foreignCreate = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ projectId, name: "Hostile Milestone" });
    expect(foreignCreate.status).toBe(403);

    const ownList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`);
    expect(ownList.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);
    expect(ownList.body.projects.map((row: { id: string }) => row.id)).not.toContain(foreignProjectId);

    const strangerList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerList.body.projects.map((row: { id: string }) => row.id)).toContain(foreignProjectId);
    expect(strangerList.body.projects.map((row: { id: string }) => row.id)).not.toContain(projectId);

    const contractorList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(contractorList.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);
    expect(contractorList.body.projects.map((row: { id: string }) => row.id)).not.toContain(foreignProjectId);

    const clientPassports = await request(app)
      .get("/api/v1/passports")
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientPassports.status).toBe(200);
    expect(clientPassports.body.data.passports.map((row: { project: { id: string } }) => row.project.id)).toContain(projectId);

    const unrelatedPassports = await request(app)
      .get("/api/v1/passports")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(unrelatedPassports.status).toBe(200);
    expect(unrelatedPassports.body.data.passports.map((row: { project: { id: string } }) => row.project.id))
      .toContain(foreignProjectId);
    expect(unrelatedPassports.body.data.passports.map((row: { project: { id: string } }) => row.project.id))
      .not.toContain(projectId);

    const assignedPassport = await request(app)
      .get(`/api/v1/passports/${projectId}`)
      .set("Authorization", `Bearer ${contractor.token}`);
    expect(assignedPassport.status).toBe(200);
  });

  it("lets ADMIN read another contractor's project and milestone", async () => {
    const owner = await registerContractor("Admin Read Owner");
    const client = await registerClient("Admin Read Client");
    const admin = await privileged(Role.ADMIN, "IDOR Admin");
    const auditor = await privileged(Role.AUDITOR, "IDOR Auditor");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Visible To Admin", contractorId: owner.contractorId });
    const projectId = created.body.data.project.id as string;
    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Admin Visible Milestone" });
    const milestoneId = milestone.body.data.milestone.id as string;

    const adminProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminProject.status).toBe(200);

    const adminList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminList.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);

    const auditorMilestone = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(auditorMilestone.status).toBe(200);

    const adminContractor = await request(app)
      .get(`/api/v1/contractors/${owner.contractorId}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(adminContractor.status).toBe(200);
  });
});
