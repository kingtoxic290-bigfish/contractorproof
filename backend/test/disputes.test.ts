import { Role } from "@prisma/client";
import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { signAccessToken } from "../src/utils/jwt";
import { hashPassword } from "../src/utils/password";

type Account = {
  token: string;
  userId: string;
  email: string;
};

const createdUserIds: string[] = [];
const createdProjectIds: string[] = [];
const createdDisputeIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

function assertSafePayload(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/storageKey/i);
  expect(serialized).not.toMatch(/storageReference/i);
  expect(serialized).not.toMatch(/storage\//i);
  expect(serialized).not.toMatch(/\/home\//);
  expect(serialized).not.toMatch(/trustScore|riskScore|confidenceScore|safetyScore|contractorScore/);
}

async function registerContractor(fullName: string): Promise<Account & { contractorId: string }> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("contractor"),
    password: "password123",
    fullName,
    role: "CONTRACTOR",
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  const contractor = await prisma.contractor.findUnique({
    where: { userId: response.body.user.id },
  });
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
    contractorId: contractor!.id,
  };
}

async function registerClient(fullName: string): Promise<Account> {
  const response = await request(app).post("/api/v1/auth/register").send({
    email: uniqueEmail("client"),
    password: "password123",
    fullName,
    role: "CLIENT",
  });
  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);
  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
  };
}

async function privileged(role: Role): Promise<Account> {
  const email = uniqueEmail(role.toLowerCase());
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword("password123"),
      fullName: `${role} Dispute`,
      role,
    },
  });
  createdUserIds.push(user.id);
  return {
    token: signAccessToken({ sub: user.id, email: user.email, role: user.role }),
    userId: user.id,
    email: user.email,
  };
}

async function seedMilestone(owner: Account & { contractorId: string }, label: string) {
  const project = await prisma.project.create({
    data: { contractorId: owner.contractorId, name: `${label} Project` },
  });
  createdProjectIds.push(project.id);
  const milestone = await prisma.milestone.create({
    data: { projectId: project.id, name: `${label} Milestone` },
  });
  return { project, milestone };
}

afterEach(async () => {
  const disputeIds = createdDisputeIds.splice(0);
  const projectIds = createdProjectIds.splice(0);
  const userIds = createdUserIds.splice(0);

  if (disputeIds.length > 0) {
    await prisma.dispute.deleteMany({ where: { id: { in: disputeIds } } });
  }
  if (projectIds.length > 0) {
    await prisma.dispute.deleteMany({ where: { milestone: { projectId: { in: projectIds } } } });
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

describe("POST /api/v1/disputes", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).post("/api/v1/disputes").send({
      milestoneId: "11111111-1111-4111-8111-111111111111",
      reason: "work does not match the drawing",
    });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", "Bearer not-a-valid-token")
      .send({
        milestoneId: "11111111-1111-4111-8111-111111111111",
        reason: "work does not match the drawing",
      });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 400 when required fields are missing", async () => {
    const owner = await registerContractor("Missing Fields Owner");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({});
    expect(response.status).toBe(400);
  });

  it("returns 400 for a malformed milestone UUID", async () => {
    const owner = await registerContractor("Bad Uuid Owner");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: "not-a-uuid",
        reason: "work does not match the drawing",
      });
    expect(response.status).toBe(400);
  });

  it("forbids an unauthorized role from creating a dispute", async () => {
    const owner = await registerContractor("Auditor Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "auditor-create");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "auditor should not raise this",
      });
    expect(response.status).toBe(403);
  });

  it("forbids a contractor from creating a dispute on another contractor's project", async () => {
    const owner = await registerContractor("Owner A");
    const other = await registerContractor("Owner B");
    const seeded = await seedMilestone(owner, "cross-create");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        evidenceId: "11111111-1111-4111-8111-111111111111",
        projectId: seeded.project.id,
        contractorId: owner.contractorId,
        reason: "attempted cross-project dispute",
      });
    expect(response.status).toBe(403);
  });

  it("does not let changing milestoneId bypass contractor isolation", async () => {
    const ownerA = await registerContractor("Swap Owner A");
    const ownerB = await registerContractor("Swap Owner B");
    const seededA = await seedMilestone(ownerA, "swap-a");
    const seededB = await seedMilestone(ownerB, "swap-b");

    const swapped = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${ownerA.token}`)
      .send({
        milestoneId: seededB.milestone.id,
        projectId: seededA.project.id,
        evidenceId: "11111111-1111-4111-8111-111111111199",
        reason: "id swap",
      });
    expect(swapped.status).toBe(403);
  });

  it("persists a dispute for the owning contractor using the JWT identity", async () => {
    const owner = await registerContractor("Raise Owner");
    const other = await registerContractor("Impersonation Target");
    const seeded = await seedMilestone(owner, "raise");

    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "progress claim does not match site works",
        raisedById: other.userId,
        actorId: other.userId,
        userId: other.userId,
        status: "RESOLVED",
        role: "ADMIN",
        evidenceId: "11111111-1111-4111-8111-111111111188",
        originalEventId: "11111111-1111-4111-8111-111111111177",
      });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      data: {
        dispute: {
          milestoneId: seeded.milestone.id,
          raisedById: owner.userId,
          status: "OPEN",
          reason: "progress claim does not match site works",
        },
      },
      meta: {},
    });
    expect(response.body.data.dispute.id).toEqual(expect.any(String));
    expect(response.body.data.dispute.raisedById).not.toBe(other.userId);
    expect(response.body.data.dispute.status).not.toBe("RESOLVED");
    assertSafePayload(response.body);
    createdDisputeIds.push(response.body.data.dispute.id);

    const row = await prisma.dispute.findUnique({
      where: { id: response.body.data.dispute.id },
    });
    expect(row).not.toBeNull();
    expect(row!.raisedById).toBe(owner.userId);
    expect(row!.milestoneId).toBe(seeded.milestone.id);
    expect(row!.status).toBe("OPEN");
    expect(row!.originalEventId).toBeNull();
    expect(row!.resolutionEventId).toBeNull();
  });

  it("allows ADMIN to create a dispute on a contractor project", async () => {
    const owner = await registerContractor("Admin Target");
    const admin = await privileged(Role.ADMIN);
    const seeded = await seedMilestone(owner, "admin-raise");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${admin.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "admin recorded a dispute",
      });
    expect(response.status).toBe(201);
    expect(response.body.data.dispute.raisedById).toBe(admin.userId);
    expect(response.body.data.dispute.status).toBe("OPEN");
    createdDisputeIds.push(response.body.data.dispute.id);
  });

  it("forbids CLIENT without project membership from creating a dispute", async () => {
    const owner = await registerContractor("Client Target");
    const client = await registerClient("No Membership Client");
    const seeded = await seedMilestone(owner, "client-block");
    const response = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${client.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "client has no membership",
      });
    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/disputes", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/disputes");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 400 for a malformed filter UUID", async () => {
    const owner = await registerContractor("Filter Owner");
    const response = await request(app)
      .get("/api/v1/disputes")
      .query({ milestoneId: "not-a-uuid" })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(400);
  });

  it("returns an empty canonical list when the contractor has no disputes", async () => {
    const owner = await registerContractor("Empty Owner");
    await seedMilestone(owner, "empty");
    const response = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ data: { disputes: [] }, meta: {} });
  });

  it("lists only disputes the contractor can access", async () => {
    const owner = await registerContractor("List Owner");
    const other = await registerContractor("List Other");
    const seeded = await seedMilestone(owner, "list-own");
    const otherSeeded = await seedMilestone(other, "list-other");

    const own = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "own dispute",
      });
    expect(own.status).toBe(201);
    createdDisputeIds.push(own.body.data.dispute.id);

    const foreign = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${other.token}`)
      .send({
        milestoneId: otherSeeded.milestone.id,
        reason: "foreign dispute",
      });
    expect(foreign.status).toBe(201);
    createdDisputeIds.push(foreign.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.disputes).toHaveLength(1);
    expect(listed.body.data.disputes[0].id).toBe(own.body.data.dispute.id);
    expect(listed.body.data.disputes.map((row: { id: string }) => row.id)).not.toContain(
      foreign.body.data.dispute.id,
    );
    assertSafePayload(listed.body);

    const swapped = await request(app)
      .get("/api/v1/disputes")
      .query({
        milestoneId: otherSeeded.milestone.id,
        projectId: otherSeeded.project.id,
      })
      .set("Authorization", `Bearer ${owner.token}`);
    expect(swapped.status).toBe(200);
    expect(swapped.body).toEqual({ data: { disputes: [] }, meta: {} });
  });

  it("lets a privileged reader see accessible disputes", async () => {
    const owner = await registerContractor("Reader Target");
    const auditor = await privileged(Role.AUDITOR);
    const seeded = await seedMilestone(owner, "reader");
    const created = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "visible to auditor",
      });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.data.disputes.some((row: { id: string }) => row.id === created.body.data.dispute.id)).toBe(
      true,
    );
  });

  it("returns an empty list for CLIENT until membership exists", async () => {
    const owner = await registerContractor("Client List Target");
    const client = await registerClient("List Client");
    const seeded = await seedMilestone(owner, "client-list");
    const created = await request(app)
      .post("/api/v1/disputes")
      .set("Authorization", `Bearer ${owner.token}`)
      .send({
        milestoneId: seeded.milestone.id,
        reason: "hidden from client",
      });
    expect(created.status).toBe(201);
    createdDisputeIds.push(created.body.data.dispute.id);

    const listed = await request(app)
      .get("/api/v1/disputes")
      .set("Authorization", `Bearer ${client.token}`);
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({ data: { disputes: [] }, meta: {} });
  });
});
