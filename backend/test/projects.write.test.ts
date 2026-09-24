import { Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import {
  cleanupQaUsers,
  privileged,
  registerClient,
  registerContractor,
} from "./qa/fixtures";

describe("POST /api/v1/projects and POST /api/v1/milestones", () => {
  afterEach(cleanupQaUsers);

  it("creates a project for the authenticated contractor and ignores client contractorId", async () => {
    const owner = await registerContractor("Write Owner");
    const other = await registerContractor("Other Contractor");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        name: "Owned Project",
        description: "created over HTTP",
        contractorId: other.contractorId,
      });

    expect(created.status).toBe(201);
    expect(created.body.data.project).toMatchObject({
      name: "Owned Project",
      description: "created over HTTP",
      contractorId: owner.contractorId,
    });
    expect(created.body.data.project.contractorId).not.toBe(other.contractorId);
    expect(created.body.data.project.id).toEqual(expect.any(String));
  });

  it("returns 401 without a JWT and 400 when name is missing", async () => {
    const owner = await registerContractor("Validation Owner");

    const unauthenticated = await request(app).post("/api/v1/projects").send({ name: "X" });
    expect(unauthenticated.status).toBe(401);

    const missingName = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(missingName.status).toBe(400);
    expect(missingName.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("forbids a client from creating a project", async () => {
    const client = await registerClient("Project Client");
    const response = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Client Project" });
    expect(response.status).toBe(403);
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

  it("creates a milestone under an owned project via POST /milestones and the nested route", async () => {
    const owner = await registerContractor("Milestone Owner");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Milestone Project" });
    expect(project.status).toBe(201);
    const projectId = project.body.data.project.id as string;

    const nested = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${owner.token}`)
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
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ projectId, name: "Structure" });
    expect(collection.status).toBe(201);
    expect(collection.body.data.milestone.projectId).toBe(projectId);
    expect(collection.body.data.milestone.name).toBe("Structure");
  });

  it("returns 400 when milestone name or projectId is missing", async () => {
    const owner = await registerContractor("Milestone Validation");
    const project = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Validation Project" });
    const projectId = project.body.data.project.id as string;

    const missingName = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ projectId });
    expect(missingName.status).toBe(400);

    const missingProject = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Orphan" });
    expect(missingProject.status).toBe(400);
  });
});

describe("project and milestone ownership / IDOR", () => {
  afterEach(cleanupQaUsers);

  it("lets User A read their project and milestone and denies User B", async () => {
    const owner = await registerContractor("Owner A");
    const stranger = await registerContractor("Owner B");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Project A" });
    expect(created.status).toBe(201);
    const projectId = created.body.data.project.id as string;

    const ownProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownProject.status).toBe(200);
    expect(ownProject.body.project.id).toBe(projectId);

    const foreignProject = await request(app)
      .get(`/api/v1/projects/${projectId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(foreignProject.status).toBe(403);

    const milestone = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ projectId, name: "Milestone A" });
    expect(milestone.status).toBe(201);
    const milestoneId = milestone.body.data.milestone.id as string;

    const ownMilestone = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownMilestone.status).toBe(200);
    expect(ownMilestone.body.milestone.id).toBe(milestoneId);

    const foreignMilestone = await request(app)
      .get(`/api/v1/milestones/${milestoneId}`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(foreignMilestone.status).toBe(403);

    const foreignCreate = await request(app)
      .post("/api/v1/milestones")
      .set("Authorization", `Bearer ${stranger.token}`)
      .send({ projectId, name: "Hostile Milestone" });
    expect(foreignCreate.status).toBe(403);

    const ownList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(ownList.body.projects.map((row: { id: string }) => row.id)).toContain(projectId);

    const strangerList = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(strangerList.body.projects.map((row: { id: string }) => row.id)).not.toContain(projectId);
  });

  it("lets ADMIN read another contractor's project and milestone", async () => {
    const owner = await registerContractor("Admin Read Owner");
    const admin = await privileged(Role.ADMIN, "IDOR Admin");
    const auditor = await privileged(Role.AUDITOR, "IDOR Auditor");

    const created = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({ name: "Visible To Admin" });
    const projectId = created.body.data.project.id as string;
    const milestone = await request(app)
      .post(`/api/v1/projects/${projectId}/milestones`)
      .set("Authorization", `Bearer ${owner.token}`)
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
