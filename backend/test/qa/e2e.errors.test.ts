import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import {
  assertNoSecrets,
  cleanupQaUsers,
  registerContractor,
  seedProjectWithPolicy,
} from "./fixtures";

describe("error envelope and request correlation", () => {
  afterEach(cleanupQaUsers);

  it("returns structured domain errors with requestId and without stack traces", async () => {
    const owner = await registerContractor();
    const { milestone } = await seedProjectWithPolicy(owner.contractorId);

    const response = await request(app)
      .post("/api/v1/evidence")
      .set("Authorization", `Bearer ${owner.token}`)
      .field("milestoneId", milestone.id)
      .attach("file", Buffer.from("x"), "payload.exe");

    expect(response.status).toBe(400);
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
    expect(response.body.error).toMatchObject({
      code: "FILE_TYPE_NOT_ALLOWED",
      message: expect.any(String),
      requestId: expect.any(String),
    });
    expect(response.body.error.requestId).toBe(response.headers["x-request-id"]);
    expect(JSON.stringify(response.body)).not.toMatch(/at\s+\w+\s+\(/);
    expect(JSON.stringify(response.body)).not.toMatch(/prisma/i);
    assertNoSecrets(response.body);
  });

  it("keeps grandfathered auth errors as { error: string }", async () => {
    const response = await request(app).get("/api/v1/auth/me");
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "missing bearer token" });
    expect(response.headers["x-request-id"]).toEqual(expect.any(String));
  });
});
