import type { BlockchainEventType } from "@prisma/client";
import { BlockchainService } from "../blockchain/BlockchainService";
import { blockchainEventRepository } from "../repositories/blockchainEvent.repository";
import type { PublicUser } from "../types";
import {
  assertCanReadProject,
  blockchainEventListWhere,
} from "./access.service";

type ReceiptReader = Pick<BlockchainService, "getSuccessfulTransactionReceipt">;

let createReceiptReader: (() => ReceiptReader) | null = null;

/** Test seam for receipt reconciliation; production uses the configured adapter. */
export function setBlockchainReceiptReaderFactory(factory?: () => ReceiptReader): void {
  createReceiptReader = factory ?? null;
}

function receiptReader(): ReceiptReader {
  return (createReceiptReader ?? (() => new BlockchainService()))();
}

function confirmed(event: { txHash: string | null; blockNumber: number | null }): boolean {
  return Boolean(event.txHash && event.blockNumber != null && event.blockNumber > 0);
}

function toView(event: {
  id: string;
  projectId: string;
  eventType: BlockchainEventType;
  referenceId: string | null;
  txHash: string | null;
  blockNumber: number | null;
  createdAt: Date;
  recordedAt: Date;
}) {
  const isConfirmed = confirmed(event);
  return {
    id: event.id,
    projectId: event.projectId,
    eventType: event.eventType,
    referenceId: event.referenceId,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    confirmationState: isConfirmed ? "CONFIRMED" : "PENDING",
    createdAt: event.createdAt.toISOString(),
    recordedAt: event.recordedAt.toISOString(),
  };
}

export const blockchainHistoryService = {
  async list(actor: PublicUser, filters: { projectId?: string } = {}) {
    if (filters.projectId) {
      await assertCanReadProject(actor, filters.projectId);
    }
    const events = await blockchainEventRepository.list(blockchainEventListWhere(actor, filters));
    return events.map(toView);
  },

  async reconcile(actor: PublicUser, eventId: string) {
    const event = await blockchainEventRepository.findById(eventId);
    if (!event) {
      return null;
    }
    await assertCanReadProject(actor, event.projectId);

    // A confirmed row is authoritative already; never overwrite or resubmit it.
    if (confirmed(event) || !event.txHash) {
      return toView(event);
    }

    try {
      const receipt = await receiptReader().getSuccessfulTransactionReceipt(event.txHash);
      if (!receipt) {
        return toView(event);
      }
      const updated = await blockchainEventRepository.confirm(event.id, {
        txHash: receipt.txHash,
        blockNumber: receipt.blockNumber,
      });
      return toView(updated);
    } catch {
      // A provider failure does not establish that the transaction failed.
      return toView(event);
    }
  },
};
