import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { contractorRepository } from "../src/repositories/contractor.repository";
import { prisma } from "../src/repositories/prisma";

type RegisteredAccount = {
  token: string;
  userId: string;
  email: string;
  fullName: string;
};

const createdUserIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

async function registerAccount(
  role: "CONTRACTOR" | "CLIENT",
  fullName: string,
): Promise<RegisteredAccount> {
  const email = uniqueEmail(role.toLowerCase());
  const response = await request(app).post("/api/v1/auth/register").send({
    email,
    password: "password123",
    fullName,
    role,
  });

  expect(response.status).toBe(201);
  createdUserIds.push(response.body.user.id);

  return {
    token: response.body.token,
    userId: response.body.user.id,
    email: response.body.user.email,
    fullName: response.body.user.fullName,
  };
}

function assertNoSensitiveUserFields(body: unknown): void {
  const serialized = JSON.stringify(body);
  expect(serialized).not.toMatch(/passwordHash/i);
  expect(serialized).not.toMatch(/"password"\s*:/);
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

afterEach(async () => {
  if (createdUserIds.length === 0) {
    return;
  }

  const userIds = createdUserIds.splice(0);
  await prisma.auditLog.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.contractor.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe("GET /api/v1/contractors", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get("/api/v1/contractors");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 401 for an invalid JWT", async () => {
    const response = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", "Bearer not-a-valid-token");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "invalid or expired token" });
  });

  it("returns 200 and contractors from the database", async () => {
    const account = await registerAccount("CONTRACTOR", "List Contractor");
    const contractorId = await contractorIdForUser(account.userId);

    const response = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.contractors)).toBe(true);

    const match = response.body.contractors.find(
      (row: { id: string }) => row.id === contractorId,
    );
    expect(match).toMatchObject({
      id: contractorId,
      userId: account.userId,
      legalName: account.fullName,
      crbSource: "SYNTHETIC_DEMO",
      user: {
        id: account.userId,
        email: account.email,
        fullName: account.fullName,
        role: "CONTRACTOR",
      },
    });
    assertNoSensitiveUserFields(response.body);
  });

  it("returns an empty collection when there are no contractors", async () => {
    const account = await registerAccount("CLIENT", "Empty List Viewer");
    const spy = vi
      .spyOn(contractorRepository, "listContractors")
      .mockResolvedValueOnce([]);

    const response = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${account.token}`);

    spy.mockRestore();

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ contractors: [] });
  });

  it("does not include password hashes in the list payload", async () => {
    const account = await registerAccount("CONTRACTOR", "Hash Check Contractor");

    const response = await request(app)
      .get("/api/v1/contractors")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    assertNoSensitiveUserFields(response.body);
    for (const contractor of response.body.contractors) {
      expect(contractor.user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          email: expect.any(String),
          fullName: expect.any(String),
          role: expect.any(String),
        }),
      );
      expect(contractor.user).not.toHaveProperty("passwordHash");
    }
  });
});

describe("GET /api/v1/contractors/:contractorId", () => {
  it("returns 401 without a JWT", async () => {
    const response = await request(app).get(
      "/api/v1/contractors/11111111-1111-1111-1111-111111111111",
    );
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
  });

  it("returns 200 for an existing contractor", async () => {
    const account = await registerAccount("CONTRACTOR", "Detail Contractor");
    const contractorId = await contractorIdForUser(account.userId);

    const response = await request(app)
      .get(`/api/v1/contractors/${contractorId}`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    expect(response.body.contractor).toMatchObject({
      id: contractorId,
      userId: account.userId,
      legalName: "Detail Contractor",
      crbRegistrationNumber: null,
      crbCategory: null,
      crbType: null,
      crbClass: null,
      crbStatus: null,
      crbLastVerifiedAt: null,
      crbSource: "SYNTHETIC_DEMO",
      user: {
        id: account.userId,
        email: account.email,
        fullName: "Detail Contractor",
        role: "CONTRACTOR",
      },
    });
    expect(response.body.contractor.createdAt).toEqual(expect.any(String));
    expect(response.body.contractor.updatedAt).toEqual(expect.any(String));
    assertNoSensitiveUserFields(response.body);
  });

  it("returns 404 for a nonexistent contractor", async () => {
    const account = await registerAccount("CLIENT", "Missing Contractor Viewer");

    const response = await request(app)
      .get("/api/v1/contractors/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({ error: "contractor not found" });
  });

  it("returns 400 for an invalid UUID", async () => {
    const account = await registerAccount("CLIENT", "Invalid Id Viewer");

    const response = await request(app)
      .get("/api/v1/contractors/not-a-uuid")
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "contractorId must be a valid UUID" });
  });

  it("does not expose password hashes on the detail payload", async () => {
    const account = await registerAccount("CONTRACTOR", "Detail Hash Contractor");
    const contractorId = await contractorIdForUser(account.userId);

    const response = await request(app)
      .get(`/api/v1/contractors/${contractorId}`)
      .set("Authorization", `Bearer ${account.token}`);

    expect(response.status).toBe(200);
    assertNoSensitiveUserFields(response.body);
    expect(response.body.contractor.user).not.toHaveProperty("passwordHash");
  });
});
