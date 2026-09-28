import { BlockchainEventType, Role } from "@prisma/client";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../src/app";
import { prisma } from "../src/repositories/prisma";
import { setBlockchainReceiptReaderFactory } from "../src/services/blockchainHistory.service";
import {
  cleanupQaUsers,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./qa/fixtures";

describe("blockchain proof history and reconciliation", () => {
  afterEach(async () => {
    setBlockchainReceiptReaderFactory();
    await cleanupQaUsers();
  });

  async function seedEvent(txHash: string | null = `0x${"ab".repeat(32)}`) {
    const owner = await registerContractor("Proof Owner");
    const { project } = await seedProjectWithPolicy(owner.contractorId);
    const event = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:proof-history`,
        referenceId: "11111111-1111-4111-8111-111111111111",
        evidenceHash: "ab".repeat(32),
        txHash,
      },
    });
    return { owner, project, event };
  }

  it("lists only authorized project proof history and exposes safe fields", async () => {
    const { owner, project, event } = await seedEvent();
    const other = await registerContractor("Other Owner");
    const admin = await privileged(Role.ADMIN);

    const own = await request(app)
      .get(`/api/v1/blockchain?projectId=${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(own.status).toBe(200);
    expect(own.body.data.events).toEqual([
      expect.objectContaining({
        id: event.id,
        projectId: project.id,
        eventType: "VERIFICATION",
        referenceId: event.referenceId,
        txHash: event.txHash,
        blockNumber: null,
        confirmationState: "PENDING",
      }),
    ]);
    expect(JSON.stringify(own.body)).not.toMatch(/privateKey|rpcUrl|storageReference|password/i);

    const denied = await request(app)
      .get(`/api/v1/blockchain?projectId=${project.id}`)
      .set("Authorization", `Bearer ${other.token}`);
    expect(denied.status).toBe(403);

    const privilegedRead = await request(app)
      .get(`/api/v1/blockchain?projectId=${project.id}`)
      .set("Authorization", `Bearer ${admin.token}`);
    expect(privilegedRead.status).toBe(200);
    expect(privilegedRead.body.data.events).toHaveLength(1);

    const unauthenticated = await request(app).get("/api/v1/blockchain");
    expect(unauthenticated.status).toBe(401);
  });

  it("confirms a pending hash only from a successful receipt and is idempotent", async () => {
    const { owner, event } = await seedEvent();
    const readReceipt = vi.fn().mockResolvedValue({ txHash: event.txHash!, blockNumber: 71 });
    setBlockchainReceiptReaderFactory(() => ({ getSuccessfulTransactionReceipt: readReceipt }));

    const first = await request(app)
      .post(`/api/v1/blockchain/${event.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(first.status).toBe(200);
    expect(first.body.data.event).toMatchObject({
      id: event.id,
      txHash: event.txHash,
      blockNumber: 71,
      confirmationState: "CONFIRMED",
    });

    const second = await request(app)
      .post(`/api/v1/blockchain/${event.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(second.status).toBe(200);
    expect(second.body.data.event.confirmationState).toBe("CONFIRMED");
    expect(readReceipt).toHaveBeenCalledTimes(1);
    expect(await prisma.blockchainEvent.count({ where: { logicalKey: event.logicalKey } })).toBe(1);
  });

  it("keeps no-receipt, failed-receipt, provider-error, and no-hash events pending without submitting", async () => {
    const { owner, event } = await seedEvent();
    const readReceipt = vi.fn().mockResolvedValue(null);
    setBlockchainReceiptReaderFactory(() => ({ getSuccessfulTransactionReceipt: readReceipt }));

    const noReceipt = await request(app)
      .post(`/api/v1/blockchain/${event.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(noReceipt.body.data.event.confirmationState).toBe("PENDING");

    readReceipt.mockRejectedValueOnce(new Error("provider unavailable"));
    const providerFailure = await request(app)
      .post(`/api/v1/blockchain/${event.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(providerFailure.body.data.event.confirmationState).toBe("PENDING");

    const noHash = await prisma.blockchainEvent.create({
      data: {
        projectId: event.projectId,
        eventType: BlockchainEventType.ATTESTATION,
        logicalKey: `${BlockchainEventType.ATTESTATION}:${event.projectId}:no-hash`,
        referenceId: "22222222-2222-4222-8222-222222222222",
      },
    });
    const noHashResponse = await request(app)
      .post(`/api/v1/blockchain/${noHash.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(noHashResponse.body.data.event.confirmationState).toBe("PENDING");
    expect(readReceipt).toHaveBeenCalledTimes(2);
    expect(await prisma.blockchainEvent.count({ where: { projectId: event.projectId } })).toBe(2);
  });

  it("updates the existing Passport and public-verification projections after reconciliation", async () => {
    const owner = await registerContractor("Projection Owner");
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("reconciled public proof");
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "proof.txt");
    const version = upload.body.data.evidence.currentVersion;
    const event = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        logicalKey: `${BlockchainEventType.VERIFICATION}:${project.id}:${version.id}`,
        referenceId: version.id,
        evidenceHash: version.sha256,
        txHash: `0x${"cd".repeat(32)}`,
      },
    });
    setBlockchainReceiptReaderFactory(() => ({
      getSuccessfulTransactionReceipt: async () => ({ txHash: event.txHash!, blockNumber: 72 }),
    }));

    const pending = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(pending.body.data.verification.status).toBe("PENDING");

    await request(app)
      .post(`/api/v1/blockchain/${event.id}/reconcile`)
      .set("Authorization", `Bearer ${owner.token}`)
      .expect(200);

    const publicMatch = await request(app)
      .post("/api/v1/public/verify")
      .field("evidenceVersionId", version.id)
      .attach("file", bytes, "proof.txt");
    expect(publicMatch.body.data.verification.status).toBe("MATCH");

    const passport = await request(app)
      .get(`/api/v1/passports/${project.id}`)
      .set("Authorization", `Bearer ${owner.token}`);
    expect(passport.status).toBe(200);
    expect(passport.body.data.passport.blockchainProofs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: event.id, confirmationState: "CONFIRMED", blockNumber: 72 }),
      ]),
    );
  });
});
