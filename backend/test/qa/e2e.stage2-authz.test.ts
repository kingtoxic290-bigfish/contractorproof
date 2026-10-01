import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import {
  assertNoSecrets,
  cleanupQaUsers,
  registerClient,
  registerContractor,
  seedProjectWithPolicy,
} from "./fixtures";

describe("Stage 2 GET contractors/projects authorization", () => {
  afterEach(cleanupQaUsers);

  it("scopes contractor projects while exposing assignable contractors and client-owned projects", async () => {
    const owner = await registerContractor("Listed Owner");
    const stranger = await registerContractor("Stranger Reader");
    const client = await registerClient("Listed Client");
    const { project } = await seedProjectWithPolicy(owner.contractorId);

    const contractors = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(contractors.status).toBe(200);
    const contractorIds = contractors.body.contractors.map((row: { id: string }) => row.id);
    expect(contractorIds).toContain(stranger.contractorId);
    expect(contractorIds).not.toContain(owner.contractorId);
    assertNoSecrets(contractors.body);

    const assignableContractors = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${client.token}`);
    expect(assignableContractors.status).toBe(200);
    expect(assignableContractors.body.contractors.map((row: { id: string }) => row.id)).toContain(owner.contractorId);

    const contractorDetail = await request(app)
      .get(`/api/v1/contractors/${owner.contractorId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(contractorDetail.status).toBe(200);
    assertNoSecrets(contractorDetail.body);

    const clientProject = await request(app)
      .post("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`)
      .send({ name: "Client-owned project", contractorId: owner.contractorId });
    expect(clientProject.status).toBe(201);
    const clientProjectId = clientProject.body.data.project.id as string;

    const projects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(projects.status).toBe(200);
    expect(projects.body.projects.map((row: { id: string }) => row.id)).not.toContain(project.id);
    expect(projects.body.projects.map((row: { id: string }) => row.id)).not.toContain(clientProjectId);
    assertNoSecrets(projects.body);

    const clientProjects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${client.token}`);
    expect(clientProjects.status).toBe(200);
    expect(clientProjects.body.projects.map((row: { id: string }) => row.id)).toEqual([clientProjectId]);

    const ownProjectDetail = await request(app)
      .get(`/api/v1/projects/${clientProjectId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(ownProjectDetail.status).toBe(200);

    const projectDetail = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(projectDetail.status).toBe(403);
    assertNoSecrets(projectDetail.body);

    const milestones = await request(app)
      .get(`/api/v1/projects/${project.id}/milestones`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(milestones.status).toBe(403);
  });

  it("still requires authentication for Stage 2 collection GETs", async () => {
    const contractors = await request(app).get("/api/v1/contractors");
    const projects = await request(app).get("/api/v1/projects");
    expect(contractors.status).toBe(401);
    expect(projects.status).toBe(401);
  });
});
