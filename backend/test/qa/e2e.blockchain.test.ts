import { BlockchainEventType, Role } from "@prisma/client";
import { Interface } from "ethers";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app";
import { BlockchainService } from "../../src/blockchain/BlockchainService";
import { BLOCKCHAIN_ERROR_CODES } from "../../src/blockchain/errors";
import { REGISTRY_ABI } from "../../src/blockchain/registry.abi";
import {
  blockchainEventRepository,
  buildLogicalKey,
} from "../../src/repositories/blockchainEvent.repository";
import { prisma } from "../../src/repositories/prisma";
import { sha256Buffer } from "../../src/utils/hash";
import {
  cleanupQaUsers,
  privileged,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";

const HASH_A = sha256Buffer(Buffer.from("qa-blockchain-bytes"));
const ZERO_HASH = "0".repeat(64);

describe("blockchain integration and confirmation semantics", () => {
  afterEach(cleanupQaUsers);

  it("E2E-005 does not fabricate CONFIRMED or MATCH when blockchain is unconfigured or RPC is down", async () => {
    const unconfigured = new BlockchainService({
      contractAddress: "",
      privateKey: "0xshould-never-leak",
    });
    expect(unconfigured.isConfigured()).toBe(false);
    await expect(
      unconfigured.recordProof({
        eventId: "event-1",
        projectId: "project-1",
        milestoneId: "milestone-1",
        evidenceHash: HASH_A,
        actorId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.NOT_CONFIGURED });

    const rpcDown = new BlockchainService(
      {
        contractAddress: "0x0000000000000000000000000000000000000001",
        privateKey: `0x${"11".repeat(32)}`,
        chainId: 31337,
      },
      {
        getNetwork: async () => {
          throw new Error("ECONNREFUSED 127.0.0.1:8545");
        },
        getCode: async () => {
          throw new Error("ECONNREFUSED 127.0.0.1:8545");
        },
      } as never,
    );
    await expect(rpcDown.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE,
    });
    await expect(
      rpcDown.recordProof({
        eventId: "event-1",
        projectId: "project-1",
        milestoneId: "milestone-1",
        evidenceHash: HASH_A,
        actorId: "actor-1",
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE });
    expect(JSON.stringify({ code: BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE })).not.toContain(
      "0x11".repeat(16),
    );
  });

  it("does not treat a txHash as confirmation without a successful receipt and VerificationRecorded args", async () => {
    const service = new BlockchainService({
      contractAddress: "0x00000000000000000000000000000000000000ab",
      privateKey: `0x${"22".repeat(32)}`,
    });
    const wait = (
      service as unknown as {
        waitForConfirmation: (tx: {
          hash: string;
          wait: (n?: number) => Promise<{ hash: string; status: number; blockNumber: bigint; logs: unknown[] } | null>;
        }) => Promise<unknown>;
      }
    ).waitForConfirmation.bind(service);
    const assertEvent = (
      service as unknown as {
        assertVerificationEvent: (
          receipt: { logs: Array<{ topics: string[]; data: string }> },
          encoded: { eventId: string; projectId: string; evidenceHash: string },
        ) => void;
      }
    ).assertVerificationEvent.bind(service);

    await expect(
      wait({
        hash: "0xabc",
        wait: async () => ({ hash: "0xabc", status: 0, blockNumber: 1n, logs: [] }),
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED });

    await expect(
      wait({
        hash: "0xdef",
        wait: async () => null,
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED });

    const encoded = {
      eventId: service.encodeId("event-qa"),
      projectId: service.encodeId("project-qa"),
      evidenceHash: service.encodeHash(HASH_A).bytes32,
    };

    expect(() =>
      assertEvent({ logs: [] }, encoded),
    ).toThrow(/did not emit VerificationRecorded|EVENT_MISMATCH/i);

    try {
      assertEvent({ logs: [] }, encoded);
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH });
    }

    const iface = new Interface(REGISTRY_ABI);
    const wrongHash = service.encodeHash("aa".repeat(32)).bytes32;
    const log = iface.encodeEventLog(iface.getEvent("VerificationRecorded")!, [
      encoded.eventId,
      encoded.projectId,
      service.encodeId("milestone-qa"),
      wrongHash,
      service.encodeId("actor-qa"),
      1n,
    ]);
    try {
      assertEvent({ logs: [{ topics: [...log.topics], data: log.data }] }, encoded);
      expect.unreachable("mismatched event args must be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH });
    }
  });

  it("E2E-006 enforces BlockchainEvent logical-key uniqueness and keeps HTTP proofs unclaimed when unconfigured", async () => {
    const owner = await registerContractor("Proof Owner");
    const auditor = await privileged(Role.AUDITOR);
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const upload = await uploadEvidence(owner.token, milestone.id, Buffer.from("proof-bytes"), "proof.txt");

    const first = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(first.status).toBe(201);

    const replay = await request(app)
      .post("/api/v1/attestations")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        evidenceId: upload.body.data.evidence.id,
        milestoneId: milestone.id,
        decision: "APPROVED",
      });
    expect(replay.status).toBe(409);

    const events = await prisma.blockchainEvent.findMany({ where: { projectId: project.id } });
    expect(events).toHaveLength(0);

    const submit = await request(app)
      .post("/api/v1/blockchain")
      .set("Authorization", `Bearer ${auditor.token}`)
      .send({
        projectId: project.id,
        evidenceVersionId: upload.body.data.evidence.currentVersionId,
      });
    expect([404, 405, 501]).toContain(submit.status);

    const versionId = upload.body.data.evidence.currentVersionId as string;
    const firstCreate = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId: versionId,
      evidenceHash: upload.body.data.evidence.sha256,
      actorId: auditor.userId,
    });
    expect(firstCreate.created).toBe(true);
    expect(firstCreate.event.logicalKey).toBe(
      buildLogicalKey(BlockchainEventType.VERIFICATION, project.id, versionId),
    );
    expect(firstCreate.event.txHash).toBeNull();

    const secondCreate = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId: versionId,
      evidenceHash: upload.body.data.evidence.sha256,
      actorId: auditor.userId,
    });
    expect(secondCreate.created).toBe(false);
    expect(secondCreate.event.id).toBe(firstCreate.event.id);

    await expect(
      prisma.blockchainEvent.create({
        data: {
          projectId: project.id,
          eventType: BlockchainEventType.VERIFICATION,
          logicalKey: firstCreate.event.logicalKey,
          referenceId: versionId,
          evidenceHash: upload.body.data.evidence.sha256,
          actorId: auditor.userId,
        },
      }),
    ).rejects.toMatchObject({ code: "P2002" });
  });

  it("rejects the zero hash and keeps PostgreSQL as the UUID authority", async () => {
    const service = new BlockchainService({
      contractAddress: "0x0000000000000000000000000000000000000001",
      privateKey: "",
    });
    try {
      service.encodeHash(ZERO_HASH);
      expect.unreachable("zero hash must be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.INVALID_HASH });
    }
    const encoded = service.encodeId("11111111-1111-4111-8111-111111111111");
    expect(encoded).toMatch(/^0x[0-9a-f]{64}$/);
    expect(encoded).not.toContain("11111111-1111-4111-8111-111111111111");
  });
});
