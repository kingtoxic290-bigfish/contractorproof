import { randomUUID } from "crypto";
import { BlockchainEventType } from "@prisma/client";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { BlockchainService } from "../../src/blockchain/BlockchainService";
import { BLOCKCHAIN_ERROR_CODES } from "../../src/blockchain/errors";
import { prisma } from "../../src/repositories/prisma";
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

describe("E2E-029 live Hardhat BlockchainService", () => {
  let live = false;

  beforeAll(async () => {
    live = await ensureLocalHardhat();
  }, 30_000);

  afterAll(() => {
    stopQaHardhat();
  });

  afterEach(cleanupQaUsers);

  it("deploys ContractorProofRegistry, records a real proof, and persists CONFIRMED fields", async () => {
    if (!live) {
      expect.fail("local Hardhat RPC was not available");
    }
    const owner = await registerContractor("Live Chain Owner");
    const { project, milestone } = await seedProjectWithPolicy(owner.contractorId);
    const bytes = Buffer.from("live-hardhat-evidence-bytes");
    const expectedHash = independentSha256(bytes);
    const upload = await uploadEvidence(owner.token, milestone.id, bytes, "live.txt");
    expect(upload.status).toBe(201);
    expect(upload.body.data.evidence.sha256).toBe(expectedHash);

    const deployed = await deployContractorProofRegistry();
    const serviceConfig = {
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress: deployed.address,
      privateKey: HARDHAT_TEST_PRIVATE_KEY,
      chainId: HARDHAT_CHAIN_ID,
      confirmations: 1,
    };
    const service = new BlockchainService(serviceConfig);

    const registered = await service.registerProject({
      projectId: project.id,
      contractorId: owner.contractorId,
    });
    expect(registered.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(registered.blockNumber).toBeGreaterThan(0);
    expect(await service.projectIsRegistered(project.id)).toBe(true);

    const eventId = randomUUID();
    // A second service instance is required: getSignerContract() builds a new
    // Wallet per call and sequential writes on one JsonRpcProvider can fail.
    const recorder = new BlockchainService(serviceConfig);
    const proof = await recorder.recordProof({
      eventId,
      projectId: project.id,
      milestoneId: milestone.id,
      evidenceHash: expectedHash,
      actorId: owner.userId,
    });

    expect(proof.txHash).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(proof.blockNumber).toBeGreaterThan(0);
    expect(proof.evidenceHash).toBe(expectedHash);
    expect(proof.eventId).toBe(eventId);
    expect(proof.contractAddress.toLowerCase()).toBe(deployed.address.toLowerCase());
    expect(await service.eventExists(eventId)).toBe(true);

    const receipt = await deployed.provider.getTransactionReceipt(proof.txHash);
    expect(receipt?.status).toBe(1);
    expect(Number(receipt?.blockNumber)).toBe(proof.blockNumber);

    const pending = await prisma.blockchainEvent.create({
      data: {
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId: upload.body.data.evidence.currentVersionId,
        evidenceHash: expectedHash,
        actorId: owner.userId,
      },
    });
    expect(pending.txHash).toBeNull();
    expect(pending.blockNumber).toBeNull();

    const confirmed = await prisma.blockchainEvent.update({
      where: { id: pending.id },
      data: {
        txHash: proof.txHash,
        blockNumber: proof.blockNumber,
        evidenceHash: proof.evidenceHash,
      },
    });
    expect(confirmed.txHash).toBe(proof.txHash);
    expect(confirmed.blockNumber).toBe(proof.blockNumber);
    expect(confirmed.evidenceHash).toBe(expectedHash);
    expect(confirmed.evidenceHash).toBe(upload.body.data.evidence.sha256);

    await expect(
      service.recordProof({
        eventId,
        projectId: project.id,
        milestoneId: milestone.id,
        evidenceHash: expectedHash,
        actorId: owner.userId,
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.DUPLICATE_PROOF });
  });

  it("rejects a wrong chain id, empty contract code, and an unauthorized signer", async () => {
    if (!live) {
      expect.fail("local Hardhat RPC was not available");
    }
    const deployed = await deployContractorProofRegistry();

    const wrongNetwork = new BlockchainService({
      rpcUrl: HARDHAT_RPC_URL,
      contractAddress: deployed.address,
      privateKey: HARDHAT_TEST_PRIVATE_KEY,
      chainId: 1,
      confirmations: 1,
    });
    await expect(wrongNetwork.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.WRONG_NETWORK,
    });

    const eoa = await deployed.provider.getSigner(1);
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
      contractAddress: deployed.address,
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
