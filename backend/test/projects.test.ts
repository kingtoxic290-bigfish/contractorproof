import { MilestoneStatus } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";

type RegisteredAccount = {
  token: string;
  userId: string;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

async function registerAccount(fullName: string): Promise<RegisteredAccount> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("project"),
    password: "password123",
    fullName,
    role: "CONTRACTOR",
  });

  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);

  return {
    token: response.body.token,
    userId: response.body.user.id,
  };
}

async function contractorIdForUser(userId: string): Promise<string> {
  const contractor = await prisma.contractor.findUnique({
    where: { userId },
  });
  if (!contractor) {
    throw new Error(`expected contractor for user ${userId}`);
  }
  return contractor.id;
}

async function createProject(contractorId: string, name: string) {
  const project = await prisma.project.create({
    data: {
      contractorId,
      name,
      description: `${name} description`,
      nestTenderReference: "NEST-DEMO-100",
      nestContractReference: "CNT-DEMO-100",
      ocid: "ocds-demo-100",
      procuringEntity: "Demo Procuring Entity",
      contractStatus: "ACTIVE",
      contractStartDate: new Date("2026-02-01T00:00:00.000Z"),
      contractEndDate: new Date("2027-01-31T00:00:00.000Z"),
      nestSource: "SYNTHETIC_DEMO",
    },
  });
  createdProjectIds.push(project.id);
  return project;
}

async function createMilestone(
  projectId: string,
  name: string,
  status: MilestoneStatus = MilestoneStatus.PENDING,
) {
  return prisma.milestone.create({
    data: {
      projectId,
      name,
      description: `${name} description`,
      status,
    },
  });
}

function assertNoSensitiveUserFields(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/"password"\s*:/);
}

afterEach(async () => {
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);

  if (projectIds.length > 0) {
    await prisma.milestone.deleteMany({ where: { projectId: { in: projectIds } } });
    await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
  }
  if (userIds.length > 0) {
    await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.contractor.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/projects", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/projects");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 200 and projects from the database", async () => {
    const account = await registerAccount("Project Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "List Project");

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.projects)).toBe(true);

    const match = response.body.projects.find((row: { id: string }) => row.id === project.id);
    expect(match).toMatchObject({
      id: project.id,
      contractorId,
      name: "List Project",
      description: "List Project description",
      nestTenderReference: "NEST-DEMO-100",
      nestContractReference: "CNT-DEMO-100",
      ocid: "ocds-demo-100",
      procuringEntity: "Demo Procuring Entity",
      contractStatus: "ACTIVE",
      contractStartDate: "2026-02-01T00:00:00.000Z",
      contractEndDate: "2027-01-31T00:00:00.000Z",
      nestSource: "SYNTHETIC_DEMO",
    });
    assertNoSensitiveUserFields(response.body);
  });

  it("returns an empty collection when the contractor has no projects", async () => {
    const account = await registerAccount("Empty Project Viewer");

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ projects: [] });
  });

  it("does not include password hashes in the list payload", async () => {
    const account = await registerAccount("Hash Check Project Owner");
    const contractorId = await contractorIdForUser(account.userId);
    await createProject(contractorId, "Hash Check Project");

    const response = await request(app)
      .get("/api/v1/projects")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    assertNoSensitiveUserFields(response.body);
  });
});

describe("GET /api/v1/projects/:projectId", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get(
      "/api/v1/projects/11111111-1111-1111-1111-111111111111",
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 200 for an existing project", async () => {
    const account = await registerAccount("Detail Project Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Detail Project");

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(response.body.project).toMatchObject({
      id: project.id,
      contractorId,
      name: "Detail Project",
      nestSource: "SYNTHETIC_DEMO",
    });
    expect(response.body.project.createdAt).toEqual(expect.any(String));
    expect(response.body.project.updatedAt).toEqual(expect.any(String));
    assertNoSensitiveUserFields(response.body);
  });

  it("returns 404 for a nonexistent project", async () => {
    const account = await registerAccount("Missing Project Viewer");

    const response = await request(app)
      .get("/api/v1/projects/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "project not found" });
  });

  it("returns 400 for an invalid UUID", async () => {
    const account = await registerAccount("Invalid Project Viewer");

    const response = await request(app)
      .get("/api/v1/projects/not-a-uuid")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "projectId must be a valid UUID" });
  });

  it("returns only the requested project when multiple exist", async () => {
    const account = await registerAccount("Isolation Project Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const projectA = await createProject(contractorId, "Project A");
    const projectB = await createProject(contractorId, "Project B");

    const response = await request(app)
      .get(`/api/v1/projects/${projectA.id}`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(response.body.project.id).toBe(projectA.id);
    expect(response.body.project.name).toBe("Project A");
    expect(response.body.project.id).not.toBe(projectB.id);
    expect(JSON.stringify(response.body)).not.toContain(projectB.id);
  });
});

describe("GET /api/v1/projects/:projectId/milestones", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get(
      "/api/v1/projects/11111111-1111-1111-1111-111111111111/milestones",
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/projects/11111111-1111-1111-1111-111111111111/milestones")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 200 and only that project's milestones", async () => {
    const account = await registerAccount("Milestone Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Milestone Project");
    const pending = await createMilestone(project.id, "Foundation", MilestoneStatus.PENDING);
    const verified = await createMilestone(project.id, "Structure", MilestoneStatus.VERIFIED);

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/milestones`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.milestones)).toBe(true);
    expect(response.body.milestones).toHaveLength(2);
    expect(response.body.milestones.map((row: { id: string }) => row.id)).toEqual(
      expect.arrayContaining([pending.id, verified.id]),
    );
    expect(response.body.milestones.every((row: { projectId: string }) => row.projectId === project.id)).toBe(
      true,
    );

    const statuses = response.body.milestones.map((row: { status: string }) => row.status);
    expect(statuses).toEqual(expect.arrayContaining(["PENDING", "VERIFIED"]));
    expect(statuses).not.toContain("SAFE");
    expect(statuses).not.toContain("TRUSTED");
    expect(statuses).not.toContain("APPROVED");
  });

  it("returns an empty collection when the project has no milestones", async () => {
    const account = await registerAccount("Empty Milestone Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const project = await createProject(contractorId, "Empty Milestone Project");

    const response = await request(app)
      .get(`/api/v1/projects/${project.id}/milestones`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ milestones: [] });
  });

  it("returns 404 for a nonexistent project", async () => {
    const account = await registerAccount("Missing Milestone Project Viewer");

    const response = await request(app)
      .get("/api/v1/projects/11111111-1111-4111-8111-111111111111/milestones")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "project not found" });
  });

  it("returns 400 for an invalid project UUID", async () => {
    const account = await registerAccount("Invalid Milestone Project Viewer");

    const response = await request(app)
      .get("/api/v1/projects/not-a-uuid/milestones")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "projectId must be a valid UUID" });
  });

  it("does not return milestones belonging to another project", async () => {
    const account = await registerAccount("Cross Project Owner");
    const contractorId = await contractorIdForUser(account.userId);
    const projectA = await createProject(contractorId, "Isolation Project A");
    const projectB = await createProject(contractorId, "Isolation Project B");
    const milestoneA1 = await createMilestone(
      projectA.id,
      "A1",
      MilestoneStatus.IN_PROGRESS,
    );
    const milestoneA2 = await createMilestone(
      projectA.id,
      "A2",
      MilestoneStatus.PENDING_VERIFICATION,
    );
    const milestoneB1 = await createMilestone(projectB.id, "B1", MilestoneStatus.REJECTED);

    const response = await request(app)
      .get(`/api/v1/projects/${projectA.id}/milestones`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    const ids = response.body.milestones.map((row: { id: string }) => row.id);
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(expect.arrayContaining([milestoneA1.id, milestoneA2.id]));
    expect(ids).not.toContain(milestoneB1.id);

    const statuses = response.body.milestones.map((row: { status: string }) => row.status);
    expect(statuses).toEqual(
      expect.arrayContaining(["IN_PROGRESS", "PENDING_VERIFICATION"]),
    );
    expect(statuses).not.toContain("REJECTED");
    expect(JSON.stringify(response.body)).not.toContain(milestoneB1.id);
  });
});
