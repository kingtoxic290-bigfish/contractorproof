import { readFileSync } from "fs";
import path from "path";
import request from "supertest";
import { BlockchainEventType, Role } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { prisma } from "../../src/repositories/prisma";
import {
  assertNoSecrets,
  cleanupQaUsers,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

describe("passport and public verification", () => {
  afterEach(cleanupQaUsers);

  it("returns authenticated derived list/detail envelopes without inventing missing projects", async () => {
    const auditor = await privileged(Role.AUDITOR);
    const list = await request(app)
      .get("/api/v1/passports")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.data.passports)).toBe(true);
    expect(list.body).toHaveProperty("meta");
    assertNoSecrets(list.body);

    const detail = await request(app)
      .get("/api/v1/passports/11111111-1111-4111-8111-111111111111")
      .set("Authorization", `Bearer ${auditor.token}`);
    expect(detail.status).toBe(404);
    assertNoSecrets(detail.body);

    const anonymous = await request(app).get("/api/v1/passports");
    expect(anonymous.status).toBe(401);
  });

  it("public verification accepts only approved fields and rejects malformed or unknown proofs", async () => {
    const owner = await registerContractor();
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("public-passport-bytes");
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "public.txt");
    const versionId = upload.body.data.evidence.currentVersionId as string;
    await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${versionId}`,
        referenceId: versionId,
        evidenceHash: upload.body.data.evidence.sha256,
        txHash: `0x${"cd".repeat(32)}`,
        blockNumber: 12,
      },
    });

    const match = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", versionId)
      .attach("file", bytes, "public.txt");
    expect(match.status).toBe(200);
    expect(match.body.data.verification.status).toBe("MATCH");
    expect(Object.keys(match.body.data.verification).sort()).toEqual(
      ["blockchainProof", "evidenceVersionId", "meaning", "status"].sort(),
    );
    assertNoSecrets(match.body, [owner.email]);

    const unknown = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", "11111111-1111-4111-8111-111111111111")
      .attach("file", bytes, "public.txt");
    expect(unknown.status).toBe(200);
    expect(unknown.body.data.verification.status).toBe("UNAVAILABLE");
    assertNoSecrets(unknown.body);

    const missingId = await request(app)
      .post("/api/v1/public/verify")
      .attach("file", bytes, "public.txt");
    expect(missingId.status).toBe(400);

    const missingFile = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceId", upload.body.data.evidence.id);
    expect(missingFile.status).toBe(400);

    const scaffold = await request(app).get("/api/v1/public/verify");
    expect(scaffold.status).toBe(200);
    expect(scaffold.body.data.matchMeaning).toMatch(/does not prove/i);
    expect(scaffold.body).toHaveProperty("meta");
    assertNoSecrets(scaffold.body);
  });

  it("frontend passport and verification clients do not invent trust or security scores", () => {
    const frontendRoot = path.resolve(__dirname, "../../../frontend/src");
    const passportsApi = readFileSync(
      path.join(frontendRoot, "features/passports/api/passportsApi.ts"),
      "utf8",
    );
    const verificationTypes = readFileSync(
      path.join(frontendRoot, "features/verification/types.ts"),
      "utf8",
    );
    expect(passportsApi).toMatch(/GET \/api\/v1\/passports → 501/);
    expect(passportsApi).not.toMatch(/trustScore|securityScore|99\.8%|100% verified/);
    expect(verificationTypes).toMatch(/MATCH.*MISMATCH.*PENDING.*UNAVAILABLE/s);
    expect(verificationTypes).not.toMatch(/trustScore|securityScore|VERIFIED/);

    const pages = [
      readFileSync(path.join(frontendRoot, "features/passports/pages/PassportsPage.tsx"), "utf8"),
      readFileSync(
        path.join(frontendRoot, "features/passports/pages/PassportDetailPage.tsx"),
        "utf8",
      ),
      readFileSync(path.join(frontendRoot, "features/passports/types.ts"), "utf8"),
    ].join("\n");
    expect(pages).not.toMatch(/trustScore|securityScore|complianceScore|99\.8%|100% verified|files safe/);
    expect(pages).not.toMatch(/MISMATCH\s*→\s*MATCH|PENDING\s*→\s*CONFIRMED/);
  });
});
