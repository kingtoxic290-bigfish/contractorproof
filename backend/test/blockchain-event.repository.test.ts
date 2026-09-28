import { BlockchainEventType } from "@prisma/client";
import { afterEach, describe, expect, it } from "vitest";
import {
  blockchainEventRepository,
  buildLogicalKey,
} from "../src/repositories/blockchainEvent.repository";
import { prisma } from "../src/repositories/prisma";
import { cleanupQaUsers, registerContractor, seedProjectWithPolicy } from "./qa/fixtures";

describe("BlockchainEvent repository idempotency", () => {
  afterEach(cleanupQaUsers);

  it("builds a stable logical key and rejects empty project ids", () => {
    expect(
      buildLogicalKey(BlockchainEventType.VERIFICATION, "project-a", "version-1"),
    ).toBe("VERIFICATION:project-a:version-1");
    expect(buildLogicalKey(BlockchainEventType.PROJECT_REGISTERED, "project-a")).toBe(
      "PROJECT_REGISTERED:project-a:project-a",
    );
    expect(() => buildLogicalKey(BlockchainEventType.ATTESTATION, "  ")).toThrow(
      /projectId is required/i,
    );
  });

  it("creates a pending event once and returns the same row on retry", async () => {
    const owner = await registerContractor("Event Owner");
    const { project } = await seedProjectWithPolicy(owner.contractorId);
    const referenceId = "11111111-1111-4111-8111-111111111111";

    const first = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId,
      evidenceHash: "ab".repeat(32),
      actorId: owner.userId,
    });
    expect(first.created).toBe(true);
    expect(first.event.txHash).toBeNull();
    expect(first.event.logicalKey).toBe(
      buildLogicalKey(BlockchainEventType.VERIFICATION, project.id, referenceId),
    );

    const second = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId,
      evidenceHash: "cd".repeat(32),
      actorId: owner.userId,
    });
    expect(second.created).toBe(false);
    expect(second.event.id).toBe(first.event.id);
    expect(second.event.evidenceHash).toBe("ab".repeat(32));

    const [a, b] = await Promise.all([
      blockchainEventRepository.createPending({
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId,
      }),
      blockchainEventRepository.createPending({
        projectId: project.id,
        eventType: BlockchainEventType.VERIFICATION,
        referenceId,
      }),
    ]);
    expect(new Set([a.event.id, b.event.id])).toEqual(new Set([first.event.id]));

    const count = await prisma.blockchainEvent.count({
      where: { logicalKey: first.event.logicalKey },
    });
    expect(count).toBe(1);
  });

  it("confirms only with a successful txHash and blockNumber", async () => {
    const owner = await registerContractor("Confirm Owner");
    const { project } = await seedProjectWithPolicy(owner.contractorId);
    const { event } = await blockchainEventRepository.createPending({
      projectId: project.id,
      eventType: BlockchainEventType.ATTESTATION,
      referenceId: "22222222-2222-4222-8222-222222222222",
      actorId: owner.userId,
    });

    await expect(
      blockchainEventRepository.confirm(event.id, { txHash: "", blockNumber: 1 }),
    ).rejects.toThrow(/txHash is required/i);
    await expect(
      blockchainEventRepository.confirm(event.id, {
        txHash: `0x${"ab".repeat(32)}`,
        blockNumber: 0,
      }),
    ).rejects.toThrow(/blockNumber/i);

    const confirmed = await blockchainEventRepository.confirm(event.id, {
      txHash: `0x${"ab".repeat(32)}`,
      blockNumber: 12,
      evidenceHash: "ef".repeat(32),
    });
    expect(confirmed.txHash).toBe(`0x${"ab".repeat(32)}`);
    expect(confirmed.blockNumber).toBe(12);
    expect(confirmed.evidenceHash).toBe("ef".repeat(32));
  });
});
