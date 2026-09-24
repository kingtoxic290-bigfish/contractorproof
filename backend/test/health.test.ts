import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";

describe("health", () => {
  it("returns ok from /health", async () => {
    const response = await request(app).get("/health");
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      status: "ok",
      service: "contractorproof-api",
    });
  });

  it("returns ok from /api/v1/health", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});
