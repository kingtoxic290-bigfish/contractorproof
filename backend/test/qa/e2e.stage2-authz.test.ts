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

describe("Stage 2 GET contractors/projects authorization review", () => {
  afterEach(cleanupQaUsers);

  it("GET /contractors and GET /projects are authenticate-only and list another contractor's records", async () => {
    const owner = await registerContractor("Listed Owner");
    const stranger = await registerContractor("Stranger Reader");
    const client = await registerClient("Listed Client");
    const { project } = await seedProjectWithPolicy(owner.contractorId);

    const contractors = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(contractors.status).toBe(200);
    const contractorIds = contractors.body.contractors.map((row: { id: string }) => row.id);
    expect(contractorIds).toContain(owner.contractorId);
    assertNoSecrets(contractors.body);

    const contractorDetail = await request(app)
      .get(`/api/v1/contractors/${owner.contractorId}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(contractorDetail.status).toBe(200);
    expect(contractorDetail.body.contractor.id).toBe(owner.contractorId);
    expect(contractorDetail.body.contractor.user).not.toHaveProperty("passwordHash");
    assertNoSecrets(contractorDetail.body);

    const projects = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(projects.status).toBe(200);
    expect(projects.body.projects.map((row: { id: string }) => row.id)).toContain(project.id);
    assertNoSecrets(projects.body);

    const projectDetail = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${client.token}`);
    expect(projectDetail.status).toBe(200);
    expect(projectDetail.body.project.id).toBe(project.id);
    assertNoSecrets(projectDetail.body);

    const milestones = await request(app)
      .get(`/api/v1/projects/${project.id}/milestones`)
      .set("Authorization", `Bearer ${stranger.token}`);
    expect(milestones.status).toBe(200);
    expect(milestones.body.milestones.length).toBeGreaterThan(0);
  });

  it("still requires authentication for Stage 2 collection GETs", async () => {
    const contractors = await request(app).get("/api/v1/contractors");
    const projects = await request(app).get("/api/v1/projects");
    expect(contractors.status).toBe(401);
    expect(projects.status).toBe(401);
  });
});
