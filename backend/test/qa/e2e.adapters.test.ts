import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { assertNoSecrets, cleanupQaUsers, registerContractor } from "./fixtures";

describe("synthetic external adapters", () => {
  afterEach(cleanupQaUsers);

  it("labels CRB and NeST results as SYNTHETIC_DEMO, including misses", async () => {
    const user = await registerContractor();

    const crb = await request(app)
      .get("/api/v1/integrations/crb/CRB-DEMO-001")
      .set("Authorization", `Bearer ${user.token}`);
    expect(crb.status).toBe(200);
    expect(crb.body.source).toBe("SYNTHETIC_DEMO");
    expect(crb.body.notice).toMatch(/synthetic\/demo/i);
    expect(crb.body.notice).toMatch(/no live/i);
    assertNoSecrets(crb.body);

    const crbMiss = await request(app)
      .get("/api/v1/integrations/crb/UNKNOWN-CRB")
      .set("Authorization", `Bearer ${user.token}`);
    expect(crbMiss.status).toBe(200);
    expect(crbMiss.body.source).toBe("SYNTHETIC_DEMO");
    expect(crbMiss.body.found).toBe(false);

    const nest = await request(app)
      .get("/api/v1/integrations/nest/NEST-DEMO-100")
      .set("Authorization", `Bearer ${user.token}`);
    expect(nest.status).toBe(200);
    expect(nest.body.source).toBe("SYNTHETIC_DEMO");
    expect(nest.body.notice).toMatch(/synthetic|demo/i);
    assertNoSecrets(nest.body);

    const nestMiss = await request(app)
      .get("/api/v1/integrations/nest/UNKNOWN-NEST")
      .set("Authorization", `Bearer ${user.token}`);
    expect(nestMiss.status).toBe(200);
    expect(nestMiss.body.source).toBe("SYNTHETIC_DEMO");
    expect(nestMiss.body.found).toBe(false);
  });

  it("does not expose adapter lookups without authentication", async () => {
    const crb = await request(app).get("/api/v1/integrations/crb/CRB-DEMO-001");
    const nest = await request(app).get("/api/v1/integrations/nest/NEST-DEMO-100");
    expect(crb.status).toBe(401);
    expect(nest.status).toBe(401);
  });
});
