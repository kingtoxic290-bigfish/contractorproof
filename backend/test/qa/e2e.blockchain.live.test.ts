import { randomUUID } from "crypto";
import { BlockchainEventType } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockchainService } from "../../src/blockchain/BlockchainService";
import { BLOCKCHAIN_ERROR_CODES } from "../../src/blockchain/errors";
import {
  blockchainEventRepository,
  buildLogicalKey,
} from "../../src/repositories/blockchainEvent.repository";
import { prisma } from "../../src/repositories/prisma";
import { sha256Buffer } from "../../src/utils/hash";
import {
  cleanupQaUsers,
  independentSha256,
  registerContractor,
  seedProjectWithPolicy,
  uploadEvidence,
} from "./fixtures";
import {
  deployContractorProofRegistry,
  ensureLocalHardhat,
  HARDHAT_CHAIN_ID,
  HARDHAT_RPC_URL,
  HARDHAT_TEST_PRIVATE_KEY,
  stopQaHardhat,
} from "./hardhat";

const HASH_A = sha256Buffer(Buffer.from("blockchain-service-bytes"));

/**
 * All live JSON-RPC writes for account #0 live in this single file so parallel
 * Vitest workers cannot race nonces against the same Hardhat signer.
 */
describe.sequential("E2E-029 live Hardhat BlockchainService", () => {
  let live = false;
  let contractAddress = "";

  beforeAll(async () => {
    live = await ensureLocalHardhat();
    if (live) {
      const deployed = await deployContractorProofRegistry();
      contractAddress = deployed.address;
    }
  }, 45_000);

  afterAll(() => {
    // Global setup owns the long-lived node; only stop if this file spawned one.
    stopQaHardhat();
  });

  afterEach(cleanupQaUsers);

  function service() {
    return new BlockchainService({
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress,
      privateKey: HARDHAT_TEST_PRIVATE_KEY,
      chainId: HARDHAT_CHAIN_ID,
      confirmations: 1,
    });
  }

  it("registerProject + recordVerification + recordAttestation on one cached signer", async () => {
    if (!live) {
      expect.fail(
        "local Hardhat RPC was not available (ensureLocalHardhat failed to start or connect)",
      );
    }
    const chain = service();
    const projectId = randomUUID();
    const contractorId = randomUUID();
    const milestoneId = randomUUID();
    const actorId = randomUUID();
    const verificationEventId = randomUUID();
    const attestationEventId = randomUUID();

    const registered = await chain.registerProject({ projectId, contractorId });
    expect(registered.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(registered.blockNumber).toBeGreaterThan(0);
    expect(await chain.projectIsRegistered(projectId)).toBe(true);

    const verification = await chain.recordVerification({
      eventId: verificationEventId,
      projectId,
      milestoneId,
      evidenceHash: HASH_A,
      actorId,
    });
    expect(verification.evidenceHash).toBe(HASH_A);
    expect(verification.eventId).toBe(verificationEventId);
    expect(await chain.eventExists(verificationEventId)).toBe(true);

    const attestation = await chain.recordAttestation({
      eventId: attestationEventId,
      projectId,
      evidenceHash: HASH_A,
      actorId,
      approved: true,
    });
    expect(attestation.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(await chain.eventExists(attestationEventId)).toBe(true);

    const variationEventId = randomUUID();
    const variation = await chain.recordVariation({
      eventId: variationEventId,
      previousEventId: attestationEventId,
      variationReference: randomUUID(),
      actorId,
    });
    expect(variation.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(variation.blockNumber).toBeGreaterThan(0);
    expect(await chain.eventExists(variationEventId)).toBe(true);

    const correctionEventId = randomUUID();
    const correction = await chain.recordCorrection({
      eventId: correctionEventId,
      previousEventId: verificationEventId,
      evidenceHash: HASH_A,
      actorId,
    });
    expect(correction.evidenceHash).toBe(HASH_A);
    expect(correction.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(correction.blockNumber).toBeGreaterThan(0);
    expect(await chain.eventExists(correctionEventId)).toBe(true);

    const disputeEventId = randomUUID();
    const dispute = await chain.recordDispute({
      eventId: disputeEventId,
      previousEventId: verificationEventId,
      actorId,
    });
    expect(dispute.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(dispute.blockNumber).toBeGreaterThan(0);
    expect(await chain.eventExists(disputeEventId)).toBe(true);

    const resolutionEventId = randomUUID();
    const resolution = await chain.recordResolution({
      eventId: resolutionEventId,
      disputeEventId,
      actorId,
    });
    expect(resolution.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(resolution.blockNumber).toBeGreaterThan(0);
    expect(await chain.eventExists(resolutionEventId)).toBe(true);

    await expect(chain.recordVerification({
      eventId: verificationEventId,
      projectId,
      milestoneId,
      evidenceHash: HASH_A,
      actorId,
    })).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.DUPLICATE_PROOF });
  });

  it("deploys, records a real proof, and persists CONFIRMED BlockchainEvent fields idempotently", async () => {
    if (!live) {
      expect.fail(
        "local Hardhat RPC was not available (ensureLocalHardhat failed to start or connect)",
      );
    }
    const owner = await registerContractor("Live Chain Owner");
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("live-hardhat-evidence-bytes");
    const expectedHash = independentSha256(bytes);
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "live.txt");
    expect(upload.status).toBe(201);
    expect(upload.body.data.evidence.sha256).toBe(expectedHash);

    const chain = service();
    const registered = await chain.registerProject({
      projectId: project.id,
      contractorId: owner.contractorId,
    });
    expect(registered.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(await chain.projectIsRegistered(project.id)).toBe(true);

    const eventId = randomUUID();
    const proof = await chain.recordProof({
      eventId,
      projectId: project.id,
      milestoneId: milestone.id,
      evidenceHash: expectedHash,
      actorId: owner.userId,
    });

    expect(proof.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(proof.blockNumber).toBeGreaterThan(0);
    expect(proof.evidenceHash).toBe(expectedHash);
    expect(await chain.eventExists(eventId)).toBe(true);

    const versionId = upload.body.data.evidence.currentVersionId as string;
    const { event: pending, created } = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId: versionId,
      evidenceHash: expectedHash,
      actorId: owner.userId,
    });
    expect(created).toBe(true);
    expect(pending.logicalKey).toBe(
      buildLogicalKey(BlockchainEventType.VERIFICATION, project.id, versionId),
    );
    expect(pending.txHash).toBeNull();

    const confirmed = await blockchainEventRepository.confirm(pending.id, {
      txHash: proof.txHash,
      blockNumber: proof.blockNumber,
      evidenceHash: proof.evidenceHash,
    });
    expect(confirmed.txHash).toBe(proof.txHash);
    expect(confirmed.blockNumber).toBe(proof.blockNumber);

    const retry = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId: versionId,
      evidenceHash: expectedHash,
      actorId: owner.userId,
    });
    expect(retry.created).toBe(false);
    expect(retry.event.id).toBe(pending.id);

    await expect(
      chain.recordProof({
        eventId,
        projectId: project.id,
        milestoneId: milestone.id,
        evidenceHash: expectedHash,
        actorId: owner.userId,
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.DUPLICATE_PROOF });

    expect(
      await prisma.blockchainEvent.count({
        where: {
          projectId: project.id,
          eventType: BlockchainEventType.VERIFICATION,
          referenceId: versionId,
        },
      }),
    ).toBe(1);
  });

  it("rejects a wrong chain id, empty contract code, and an unauthorized signer", async () => {
    if (!live) {
      expect.fail(
        "local Hardhat RPC was not available (ensureLocalHardhat failed to start or connect)",
      );
    }
    const wrongNetwork = new BlockchainService({
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress,
      privateKey: HARDHAT_TEST_PRIVATE_KEY,
      chainId: 1,
      confirmations: 1,
    });
    await expect(wrongNetwork.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.WRONG_NETWORK,
    });

    const { JsonRpcProvider } = await import("ethers");
    const rpc = new JsonRpcProvider(HARDHAT_RPC_URL, {
      chainId: HARDHAT_CHAIN_ID,
      name: "hardhat",
    });
    const eoa = await rpc.getSigner(1);
    const wrongContract = new BlockchainService({
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress: await eoa.getAddress(),
      privateKey: HARDHAT_TEST_PRIVATE_KEY,
      chainId: HARDHAT_CHAIN_ID,
      confirmations: 1,
    });
    await expect(wrongContract.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.WRONG_CONTRACT,
    });

    const outsiderKey = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
    const outsider = new BlockchainService({
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress,
      privateKey: outsiderKey,
      chainId: HARDHAT_CHAIN_ID,
      confirmations: 1,
    });
    await expect(
      outsider.registerProject({
        projectId: randomUUID(),
        contractorId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.SIGNER_UNAVAILABLE });
  });
});
