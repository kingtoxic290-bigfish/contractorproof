import {
  BlockchainEventType,
  type BlockchainEvent,
  type Prisma,
} from "@prisma/client";
import { prisma } from "./prisma";
import { RepositoryError } from "./errors";

export type CreateBlockchainEventInput = {
  projectId: string;
  eventType: BlockchainEventType;
  /** Application reference (evidenceVersionId, attestationId, etc.). Defaults to projectId for PROJECT_REGISTERED. */
  referenceId?: string | null;
  previousEventId?: string | null;
  evidenceHash?: string | null;
  actorId?: string | null;
  /** Optional override; defaults to buildLogicalKey(...). */
  logicalKey?: string;
};

export type ConfirmBlockchainEventInput = {
  txHash: string;
  blockNumber: number;
  evidenceHash?: string | null;
};

/**
 * Deterministic idempotency key shared by DB uniqueness and callers.
 * Format: `${eventType}:${projectId}:${referenceSegment}`
 * where referenceSegment is referenceId, or projectId when absent (e.g. PROJECT_REGISTERED).
 */
export function buildLogicalKey(
  eventType: BlockchainEventType,
  projectId: string,
  referenceId?: string | null,
): string {
  const project = projectId.trim();
  if (!project) {
    throw new RepositoryError("projectId is required for blockchain event logical key");
  }
  const reference = (referenceId ?? "").trim() || project;
  return `${eventType}:${project}:${reference}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

export const blockchainEventRepository = {
  buildLogicalKey,

  findById(id: string): Promise<BlockchainEvent | null> {
    return prisma.blockchainEvent.findUnique({ where: { id } });
  },

  findByLogicalKey(logicalKey: string): Promise<BlockchainEvent | null> {
    return prisma.blockchainEvent.findUnique({ where: { logicalKey } });
  },

  listByProject(projectId: string): Promise<BlockchainEvent[]> {
    return prisma.blockchainEvent.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  },

  /**
   * Insert a pending event (txHash null). On unique conflict, returns the existing row
   * so callers can treat retries as idempotent rather than creating duplicates.
   */
  async createPending(
    input: CreateBlockchainEventInput,
  ): Promise<{ event: BlockchainEvent; created: boolean }> {
    const logicalKey =
      input.logicalKey?.trim() ||
      buildLogicalKey(input.eventType, input.projectId, input.referenceId);

    const existing = await prisma.blockchainEvent.findUnique({ where: { logicalKey } });
    if (existing) {
      return { event: existing, created: false };
    }

    const data: Prisma.BlockchainEventCreateInput = {
      logicalKey,
      eventType: input.eventType,
      referenceId: input.referenceId ?? null,
      evidenceHash: input.evidenceHash ?? null,
      project: { connect: { id: input.projectId } },
      ...(input.previousEventId
        ? { previousEvent: { connect: { id: input.previousEventId } } }
        : {}),
      ...(input.actorId ? { actor: { connect: { id: input.actorId } } } : {}),
    };

    try {
      const event = await prisma.blockchainEvent.create({ data });
      return { event, created: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        const raced = await prisma.blockchainEvent.findUnique({ where: { logicalKey } });
        if (raced) {
          return { event: raced, created: false };
        }
      }
      throw error;
    }
  },

  /**
   * Persist confirmation fields after a successful receipt (status == 1).
   * Does not invent confirmation when txHash is missing.
   */
  async confirm(
    id: string,
    input: ConfirmBlockchainEventInput,
  ): Promise<BlockchainEvent> {
    const txHash = input.txHash.trim();
    if (!txHash) {
      throw new RepositoryError("txHash is required to confirm a blockchain event");
    }
    if (!Number.isFinite(input.blockNumber) || input.blockNumber <= 0) {
      throw new RepositoryError("blockNumber must be a positive integer");
    }

    return prisma.blockchainEvent.update({
      where: { id },
      data: {
        txHash,
        blockNumber: input.blockNumber,
        ...(input.evidenceHash !== undefined ? { evidenceHash: input.evidenceHash } : {}),
      },
    });
  },
};
