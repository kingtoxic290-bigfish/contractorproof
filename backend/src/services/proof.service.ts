import {
  AttestationDecision,
  BlockchainEventType,
  type Attestation,
  type BlockchainEvent,
} from "@prisma/client";
import {
  BlockchainService,
  type ConfirmedProof,
  type RecordProofInput,
} from "../blockchain/BlockchainService";
import { BLOCKCHAIN_ERROR_CODES, BlockchainError } from "../blockchain/errors";
import { ApiError } from "../http/errors";
import {
  blockchainEventRepository,
  buildLogicalKey,
} from "../repositories/blockchainEvent.repository";

/**
 * Task 2B proof orchestration.
 *
 * Consistency strategy (Postgres + EVM are not one atomic transaction):
 * 1. createPending BlockchainEvent (txHash null) — not a confirmed proof
 * 2. ensure project registered on-chain
 * 3. submit chain tx; require receipt.status == 1
 * 4. confirm(txHash, blockNumber)
 *
 * Confirmed proof is only non-null txHash (ADR-0002). Unconfigured registries
 * skip chain writes and return proof: null — never fabricate confirmation.
 *
 * INTERNAL MATCH may be anchored as VERIFICATION when the registry is writable
 * (Task 2B golden path). MISMATCH / PENDING / UNAVAILABLE never write.
 * Public compare never writes.
 */

export type ProofBlockchainWriter = {
  isConfigured(): boolean;
  canWrite(): boolean;
  projectIsRegistered(projectId: string): Promise<boolean>;
  registerProject(input: { projectId: string; contractorId: string }): Promise<ConfirmedProof>;
  recordProof(input: RecordProofInput): Promise<ConfirmedProof>;
  recordAttestation(input: {
    eventId: string;
    projectId: string;
    evidenceHash: string;
    actorId: string;
    approved: boolean;
  }): Promise<ConfirmedProof>;
  recordCorrection(input: {
    eventId: string;
    previousEventId: string;
    evidenceHash: string;
    actorId: string;
  }): Promise<ConfirmedProof>;
  recordDispute(input: {
    eventId: string;
    previousEventId: string;
    actorId: string;
  }): Promise<ConfirmedProof>;
  recordResolution(input: {
    eventId: string;
    disputeEventId: string;
    actorId: string;
  }): Promise<ConfirmedProof>;
  recordVariation(input: {
    eventId: string;
    previousEventId: string;
    variationReference: string;
    actorId: string;
  }): Promise<ConfirmedProof>;
};

export type ProofView = {
  id: string;
  eventType: BlockchainEventType;
  txHash: string | null;
  blockNumber: number | null;
  evidenceHash: string | null;
  logicalKey: string;
};

let createWriter: (() => ProofBlockchainWriter) | null = null;

/** Test seam only. */
export function setProofBlockchainWriterFactory(factory?: () => ProofBlockchainWriter): void {
  createWriter = factory ?? null;
}

function writer(): ProofBlockchainWriter {
  return (createWriter ?? (() => new BlockchainService()))();
}

function toProofView(event: BlockchainEvent): ProofView {
  return {
    id: event.id,
    eventType: event.eventType,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    evidenceHash: event.evidenceHash,
    logicalKey: event.logicalKey,
  };
}

function mapBlockchainFailure(error: unknown): never {
  if (error instanceof ApiError) {
    throw error;
  }
  if (error instanceof BlockchainError) {
    const status =
      error.code === BLOCKCHAIN_ERROR_CODES.NOT_CONFIGURED ||
      error.code === BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE
        ? 503
        : 502;
    throw new ApiError(status, error.code, error.message);
  }
  throw new ApiError(502, BLOCKCHAIN_ERROR_CODES.TRANSACTION_FAILED, "blockchain transaction failed");
}

function chainWritesRequired(chain: ProofBlockchainWriter): boolean {
  // When a test injects a writer, treat chain writes as required.
  if (createWriter) {
    return true;
  }
  return chain.isConfigured() && chain.canWrite();
}

async function ensureProjectRegistered(projectId: string, contractorId: string): Promise<void> {
  try {
    const chain = writer();
    if (await chain.projectIsRegistered(projectId)) {
      return;
    }
    await chain.registerProject({ projectId, contractorId });
  } catch (error) {
    mapBlockchainFailure(error);
  }
}

async function confirmOrReuse(params: {
  event: BlockchainEvent;
  created: boolean;
  submit: () => Promise<ConfirmedProof>;
  evidenceHash: string;
}): Promise<ProofView> {
  if (params.event.txHash && params.event.blockNumber != null) {
    return toProofView(params.event);
  }

  try {
    const confirmed = await params.submit();
    if (!confirmed.txHash || confirmed.blockNumber == null || confirmed.blockNumber <= 0) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED,
        "blockchain transaction was not confirmed",
      );
    }
    const row = await blockchainEventRepository.confirm(params.event.id, {
      txHash: confirmed.txHash,
      blockNumber: confirmed.blockNumber,
      evidenceHash: confirmed.evidenceHash || params.evidenceHash,
    });
    return toProofView(row);
  } catch (error) {
    if (
      error instanceof BlockchainError &&
      error.code === BLOCKCHAIN_ERROR_CODES.DUPLICATE_PROOF &&
      !params.created
    ) {
      // Chain already has this eventId; recover confirmation if we can re-read nothing else.
      // Without a receipt we must not invent txHash — leave pending and surface the error.
    }
    mapBlockchainFailure(error);
  }
}

export const proofService = {
  toProofView,

  verificationLogicalKey(projectId: string, evidenceVersionId: string): string {
    return buildLogicalKey(BlockchainEventType.VERIFICATION, projectId, evidenceVersionId);
  },

  attestationLogicalKey(projectId: string, evidenceId: string, verifierId: string): string {
    return buildLogicalKey(
      BlockchainEventType.ATTESTATION,
      projectId,
      `${evidenceId}:${verifierId}`,
    );
  },

  /**
   * Anchor an INTERNAL fingerprint MATCH as a VERIFICATION proof when the registry can write.
   * No-ops (returns null) when unconfigured — MATCH itself remains valid off-chain.
   */
  async anchorInternalMatch(input: {
    projectId: string;
    contractorId: string;
    milestoneId: string;
    evidenceVersionId: string;
    evidenceHash: string;
    actorId: string;
  }): Promise<ProofView | null> {
    const chain = writer();
    if (!chainWritesRequired(chain)) {
      return null;
    }

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.VERIFICATION,
      referenceId: input.evidenceVersionId,
      evidenceHash: input.evidenceHash,
      actorId: input.actorId,
    });

    await ensureProjectRegistered(input.projectId, input.contractorId);

    return confirmOrReuse({
      event,
      created,
      evidenceHash: input.evidenceHash,
      submit: () =>
        writer().recordProof({
          eventId: event.id,
          projectId: input.projectId,
          milestoneId: input.milestoneId,
          evidenceHash: input.evidenceHash,
          actorId: input.actorId,
        }),
    });
  },

  /**
   * Anchor a persisted attestation as its own authoritative business event.
   * A separate VERIFICATION proof is created only by an explicit internal MATCH.
   */
  async anchorAttestation(input: {
    attestation: Attestation;
    projectId: string;
    contractorId: string;
    milestoneId: string;
    evidenceVersionId: string;
    evidenceHash: string;
  }): Promise<{ attestationProof: ProofView | null }> {
    const chain = writer();
    if (!chainWritesRequired(chain)) {
      return { attestationProof: null };
    }

    const logicalKey = this.attestationLogicalKey(
      input.projectId,
      input.attestation.evidenceId,
      input.attestation.verifierId,
    );

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.ATTESTATION,
      referenceId: input.attestation.id,
      logicalKey,
      evidenceHash: input.evidenceHash,
      actorId: input.attestation.verifierId,
    });

    await ensureProjectRegistered(input.projectId, input.contractorId);

    const attestationProof = await confirmOrReuse({
      event,
      created,
      evidenceHash: input.evidenceHash,
      submit: () =>
        writer().recordAttestation({
          eventId: event.id,
          projectId: input.projectId,
          evidenceHash: input.evidenceHash,
          actorId: input.attestation.verifierId,
          approved: input.attestation.decision === AttestationDecision.APPROVED,
        }),
    });

    return { attestationProof };
  },

  async anchorDispute(input: {
    disputeId: string;
    projectId: string;
    originalEventId: string;
    actorId: string;
  }): Promise<ProofView | null> {
    const chain = writer();
    if (!chainWritesRequired(chain)) {
      return null;
    }

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.DISPUTE,
      referenceId: input.disputeId,
      previousEventId: input.originalEventId,
      actorId: input.actorId,
    });

    try {
      return await confirmOrReuse({
        event,
        created,
        evidenceHash: "",
        submit: () =>
          writer().recordDispute({
            eventId: event.id,
            previousEventId: input.originalEventId,
            actorId: input.actorId,
          }),
      });
    } catch {
      // A dispute is a valid business record even if its optional chain anchor is
      // unavailable. Return the persisted pending event without claiming proof.
      const pending = await blockchainEventRepository.findById(event.id);
      return toProofView(pending ?? event);
    }
  },

  async anchorCorrection(input: {
    correctionId: string;
    projectId: string;
    originalEventId: string;
    correctedEvidenceHash: string;
    actorId: string;
  }): Promise<ProofView | null> {
    const chain = writer();
    if (!chainWritesRequired(chain)) {
      return null;
    }

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.CORRECTION,
      referenceId: input.correctionId,
      previousEventId: input.originalEventId,
      evidenceHash: input.correctedEvidenceHash,
      actorId: input.actorId,
    });

    try {
      return await confirmOrReuse({
        event,
        created,
        evidenceHash: input.correctedEvidenceHash,
        submit: () => writer().recordCorrection({
          eventId: event.id,
          previousEventId: input.originalEventId,
          evidenceHash: input.correctedEvidenceHash,
          actorId: input.actorId,
        }),
      });
    } catch {
      const pending = await blockchainEventRepository.findById(event.id);
      return toProofView(pending ?? event);
    }
  },

  async anchorVariation(input: {
    variationId: string;
    projectId: string;
    previousEventId: string;
    variationReference: string;
    actorId: string;
  }): Promise<ProofView | null> {
    const chain = writer();
    if (!chainWritesRequired(chain)) return null;

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.VARIATION,
      referenceId: input.variationId,
      previousEventId: input.previousEventId,
      actorId: input.actorId,
    });

    try {
      return await confirmOrReuse({
        event,
        created,
        evidenceHash: "",
        submit: () => writer().recordVariation({
          eventId: event.id,
          previousEventId: input.previousEventId,
          variationReference: input.variationReference,
          actorId: input.actorId,
        }),
      });
    } catch {
      const pending = await blockchainEventRepository.findById(event.id);
      return toProofView(pending ?? event);
    }
  },

  async anchorDisputeResolution(input: {
    resolutionId: string;
    projectId: string;
    disputeEventId: string;
    actorId: string;
  }): Promise<ProofView | null> {
    const chain = writer();
    if (!chainWritesRequired(chain)) {
      return null;
    }

    const { event, created } = await blockchainEventRepository.createPending({
      projectId: input.projectId,
      eventType: BlockchainEventType.RESOLUTION,
      referenceId: input.resolutionId,
      previousEventId: input.disputeEventId,
      actorId: input.actorId,
    });

    try {
      return await confirmOrReuse({
        event,
        created,
        evidenceHash: "",
        submit: () =>
          writer().recordResolution({
            eventId: event.id,
            disputeEventId: input.disputeEventId,
            actorId: input.actorId,
          }),
      });
    } catch {
      const pending = await blockchainEventRepository.findById(event.id);
      return toProofView(pending ?? event);
    }
  },
};
