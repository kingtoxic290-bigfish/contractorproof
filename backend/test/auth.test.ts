import jwt from "jsonwebtoken";
import request from "supertest";
import { Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../src/app";
import { env } from "../src/config/env";
import { prisma } from "../src/repositories/prisma";
import { hashPassword } from "../src/utils/password";
import { signAccessToken } from "../src/utils/jwt";

const createdUserIds: string[] = [];

function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`;
}

async function cleanup(): Promise<void> {
  const ids = [...createdUserIds];
  createdUserIds.length = 0;
  if (ids.length === 0) {
    return;
  }
  await prisma.contractor.deleteMany({ where: { userId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
}

describe("authentication and registration", () => {
  afterEach(cleanup);

  it("registers CONTRACTOR and CLIENT and logs in with a valid password", async () => {
    const contractorEmail = uniqueEmail("contractor");
    const contractor = await request(app).post("/api/v1/auth/register").send({
      email: contractorEmail,
      password: "password123",
      fullName: "Auth Contractor",
      role: "CONTRACTOR",
    });
    expect(contractor.status).toBe(201);
    createdUserIds.push(contractor.body.user.id);
    expect(contractor.body.user.role).toBe("CONTRACTOR");
    expect(contractor.body.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(contractor.body)).not.toMatch(/passwordHash/i);

    const client = await request(app).post("/api/v1/auth/register").send({
      email: uniqueEmail("client"),
      password: "password123",
      fullName: "Auth Client",
      role: "CLIENT",
    });
    expect(client.status).toBe(201);
    createdUserIds.push(client.body.user.id);

    const login = await request(app).post("/api/v1/auth/login").send({
      email: contractorEmail,
      password: "password123",
    });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(contractor.body.user.id);
    expect(JSON.stringify(login.body)).not.toMatch(/passwordHash/i);
  });

  it("rejects privileged public registration roles", async () => {
    for (const role of ["ADMIN", "AUDITOR", "PROCUREMENT_OFFICER", "CONSULTANT_ENGINEER"]) {
      const email = uniqueEmail(role.toLowerCase());
      const response = await request(app).post("/api/v1/auth/register").send({
        email,
        password: "password123",
        fullName: "Attacker",
        role,
      });
      expect(response.status).toBe(400);
      expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
    }
  });

  it("uses the same login error for unknown accounts and wrong passwords", async () => {
    const email = uniqueEmail("known");
    const created = await request(app).post("/api/v1/auth/register").send({
      email,
      password: "password123",
      fullName: "Known User",
      role: "CLIENT",
    });
    createdUserIds.push(created.body.user.id);

    const unknown = await request(app).post("/api/v1/auth/login").send({
      email: uniqueEmail("missing"),
      password: "password123",
    });
    const wrong = await request(app).post("/api/v1/auth/login").send({
      email,
      password: "wrong-password",
    });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "invalid email or password",
    });
    expect(wrong.body.error).toMatchObject({
      code: "UNAUTHENTICATED",
      message: "invalid email or password",
    });
  });

  it("rejects missing, malformed, expired, and wrongly signed tokens", async () => {
    const missing = await request(app).get(" /api/v1/auth/me".trim());
    expect(missing.status).toBe(401);

    const malformed = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", "Bearer not-a-jwt");
    expect(malformed.status).toBe(401);

    const expired = jwt.sign(
      { sub: "user", email: "a@b.c", role: "CLIENT" },
      env.jwtSecret,
      { expiresIn: 0 },
    );
    const expiredRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${expired}`);
    expect(expiredRes.status).toBe(401);

    const badSig = jwt.sign(
      { sub: "user", email: "a@b.c", role: "CLIENT" },
      "some-other-secret-not-the-app-secret",
    );
    const badSigRes = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${badSig}`);
    expect(badSigRes.status).toBe(401);
  });

  it("does not let body userId/role impersonate another user", async () => {
    const email = uniqueEmail("self");
    const created = await request(app).post("/api/v1/auth/register").send({
      email,
      password: "password123",
      fullName: "Self User",
      role: "CLIENT",
    });
    createdUserIds.push(created.body.user.id);

    const other = await prisma.user.create({
      data: {
        email: uniqueEmail("other"),
        passwordHash: await hashPassword("password123"),
        fullName: "Other User",
        role: Role.ADMIN,
      },
    });
    createdUserIds.push(other.id);

    const me = await request(app)
      .get("/api/v1/auth/me")
      .set("Authorization", `Bearer ${created.body.token}`)
      .send({ userId: other.id, role: "ADMIN" });
    expect(me.status).toBe(200);
    expect(me.body.user.id).toBe(created.body.user.id);
    expect(me.body.user.role).toBe("CLIENT");
  });

  it("lets an authenticated ADMIN provision a privileged user and forbids public callers", async () => {
    const admin = await prisma.user.create({
      data: {
        email: uniqueEmail("admin"),
        passwordHash: await hashPassword("password123"),
        fullName: "Seed Admin",
        role: Role.ADMIN,
      },
    });
    createdUserIds.push(admin.id);
    const token = signAccessToken({ sub: admin.id, email: admin.email, role: admin.role });

    const unauthenticated = await request(app).post("/api/v1/users").send({
      email: uniqueEmail("auditor"),
      password: "password123",
      fullName: "No Auth",
      role: "AUDITOR",
    });
    expect(unauthenticated.status).toBe(401);

    const created = await request(app)
      .post("/api/v1/users")
      .set("Authorization", `Bearer ${token}`)
      .send({
        email: uniqueEmail("auditor"),
        password: "password123",
        fullName: "Provisioned Auditor",
        role: "AUDITOR",
      });
    expect(created.status).toBe(201);
    createdUserIds.push(created.body.data.user.id);
    expect(created.body.data.user.role).toBe("AUDITOR");
    expect(created.body.data.user).not.toHaveProperty("passwordHash");
  });
});
