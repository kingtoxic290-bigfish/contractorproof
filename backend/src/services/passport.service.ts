import { BlockchainEventType } from "@prisma/client";
import type { PublicUser } from "../types";
import { ApiError } from "../http/errors";
import { assertCanReadProject, projectListWhere } from "./access.service";
import { passportRepository, type PassportProjectRow } from "../repositories/passport.repository";

function iso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function toPassportProof(event: PassportProjectRow["blockchainEvents"][number]) {
  const confirmed = Boolean(event.txHash && event.blockNumber != null && event.blockNumber > 0);
  return {
    id: event.id,
    eventType: event.eventType,
    referenceId: event.referenceId,
    evidenceHash: event.evidenceHash,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    confirmationState: confirmed ? "CONFIRMED" : "PENDING",
    confirmed,
    createdAt: event.createdAt.toISOString(),
  };
}

function toRelatedProof(event: {
  id: string;
  eventType: BlockchainEventType;
  referenceId: string | null;
  txHash: string | null;
  blockNumber: number | null;
  createdAt: Date;
} | null) {
  if (!event) return null;
  const confirmed = Boolean(event.txHash && event.blockNumber != null && event.blockNumber > 0);
  return {
    id: event.id,
    eventType: event.eventType,
    referenceId: event.referenceId,
    txHash: event.txHash,
    blockNumber: event.blockNumber,
    confirmationState: confirmed ? "CONFIRMED" : "PENDING",
    confirmed,
    createdAt: event.createdAt.toISOString(),
  };
}

function procurementObservationView(observation: PassportProjectRow["contractor"]["procurementLinks"][number]["procurementRecord"]["observations"][number]) {
  return {
    id: observation.id,
    ocid: observation.ocid,
    releaseId: observation.releaseId,
    releaseDate: iso(observation.releaseDate),
    tenderReference: observation.tenderReference,
    title: observation.title,
    description: observation.description,
    buyerName: observation.buyerName,
    buyerIdentifier: observation.buyerIdentifier,
    procurementCategory: observation.procurementCategory,
    tenderStatus: observation.tenderStatus,
    awardStatus: observation.awardStatus,
    awardDate: iso(observation.awardDate),
    contractReference: observation.contractReference,
    contractStatus: observation.contractStatus,
    contractorName: observation.contractorName,
    contractorIdentifier: observation.contractorIdentifier,
    contractValue: observation.contractValue?.toString() ?? null,
    contractCurrency: observation.contractCurrency,
    contractStartDate: iso(observation.contractStartDate),
    contractEndDate: iso(observation.contractEndDate),
    normalizedData: observation.normalizedData,
    sourceDigest: observation.sourceDigest,
    retrievedAt: observation.retrievedAt.toISOString(),
  };
}

function projectPassport(row: PassportProjectRow) {
  const blockchainProofs = row.blockchainEvents.map(toPassportProof);
  const proofFor = (eventType: BlockchainEventType, referenceId: string) =>
    blockchainProofs.find(
      (proof) => proof.eventType === eventType && proof.referenceId === referenceId,
    ) ?? null;
  const proofById = (eventId: string) =>
    blockchainProofs.find((proof) => proof.id === eventId) ?? null;

  return {
    contractor: {
      id: row.contractor.id,
      legalName: row.contractor.legalName,
      crbRegistrationNumber: row.contractor.crbRegistrationNumber,
      crbCategory: row.contractor.crbCategory,
      crbType: row.contractor.crbType,
      crbClass: row.contractor.crbClass,
      crbStatus: row.contractor.crbStatus,
      crbLastVerifiedAt: iso(row.contractor.crbLastVerifiedAt),
      crbSource: row.contractor.crbSource,
      procurementRecords: row.contractor.procurementLinks.map((link) => ({
        sourceSystem: link.procurementRecord.sourceSystem,
        externalReference: link.procurementRecord.externalReference,
        sourceRecordId: link.procurementRecord.sourceRecordId,
        sourceReference: link.procurementRecord.sourceUrl,
        linkedAt: link.linkedAt.toISOString(),
        observations: link.procurementRecord.observations.map(procurementObservationView),
      })),
    },
    project: {
      id: row.id,
      contractorId: row.contractorId,
      name: row.name,
      description: row.description,
      nestTenderReference: row.nestTenderReference,
      nestContractReference: row.nestContractReference,
      ocid: row.ocid,
      procuringEntity: row.procuringEntity,
      contractStatus: row.contractStatus,
      contractStartDate: iso(row.contractStartDate),
      contractEndDate: iso(row.contractEndDate),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    milestones: row.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      status: milestone.status,
      policy: milestone.policy
        ? {
            id: milestone.policy.id,
            name: milestone.policy.name,
            requiredApprovals: milestone.policy.requiredApprovals,
            allowedRoles: milestone.policy.allowedRoles,
          }
        : null,
      createdAt: milestone.createdAt.toISOString(),
      updatedAt: milestone.updatedAt.toISOString(),
      evidence: milestone.evidence.map((evidence) => ({
        id: evidence.id,
        milestoneId: evidence.milestoneId,
        status: evidence.status,
        currentVersionId: evidence.currentVersionId,
        createdAt: evidence.createdAt.toISOString(),
        versions: evidence.versions.map((version) => ({
          id: version.id,
          versionNumber: version.versionNumber,
          sha256: version.sha256,
          createdAt: version.createdAt.toISOString(),
          verificationStatus:
            version.verifications[version.verifications.length - 1]?.status ?? null,
          verifications: version.verifications.map((verification) => ({
            id: verification.id,
            status: verification.status,
            source: verification.source,
            createdAt: verification.createdAt.toISOString(),
          })),
          blockchainProof: proofFor(BlockchainEventType.VERIFICATION, version.id),
        })),
        attestations: evidence.attestations.map((attestation) => ({
          id: attestation.id,
          evidenceId: evidence.id,
          milestoneId: attestation.milestoneId,
          policyId: milestone.policy?.id ?? null,
          decision: attestation.decision,
          verifierRole: attestation.verifierRole,
          createdAt: attestation.createdAt.toISOString(),
          blockchainProof: proofFor(BlockchainEventType.ATTESTATION, attestation.id),
        })),
      })),
      corrections: milestone.corrections.map((correction) => ({
        id: correction.id,
        status: correction.status,
        reason: correction.reason,
        createdAt: correction.createdAt.toISOString(),
        originalRecord: {
          eventId: correction.originalEvent.id,
          eventType: correction.originalEvent.eventType,
          referenceId: correction.originalEvent.referenceId,
          evidenceVersion: correction.originalEvidenceVersion
            ? {
                id: correction.originalEvidenceVersion.id,
                evidenceId: correction.originalEvidenceVersion.evidenceId,
                versionNumber: correction.originalEvidenceVersion.versionNumber,
                sha256: correction.originalEvidenceVersion.sha256,
                createdAt: correction.originalEvidenceVersion.createdAt.toISOString(),
              }
            : null,
          blockchainProof: proofById(correction.originalEvent.id),
        },
        correctedEvidence: correction.evidence
          ? {
              id: correction.evidence.id,
              currentVersionId: correction.evidence.currentVersionId,
              versions: correction.evidence.versions.map((version) => ({
                id: version.id,
                versionNumber: version.versionNumber,
                sha256: version.sha256,
                createdAt: version.createdAt.toISOString(),
              })),
            }
          : null,
        correctionProof: correction.correctionEventId
          ? proofById(correction.correctionEventId)
          : null,
        resolutions: correction.resolutions.map((resolution) => ({
          id: resolution.id,
          status: resolution.status,
          resolution: resolution.resolution,
          resolvedById: resolution.resolvedById,
          resolvedByRole: resolution.resolvedBy.role,
          correctedEvidenceVersion: resolution.correctedEvidenceVersion
            ? {
                id: resolution.correctedEvidenceVersion.id,
                evidenceId: resolution.correctedEvidenceVersion.evidenceId,
                versionNumber: resolution.correctedEvidenceVersion.versionNumber,
                sha256: resolution.correctedEvidenceVersion.sha256,
                createdAt: resolution.correctedEvidenceVersion.createdAt.toISOString(),
              }
            : null,
          createdAt: resolution.createdAt.toISOString(),
        })),
      })),
    })),
    variations: row.variations.map((variation) => ({
      id: variation.id,
      variationReference: variation.variationReference,
      reason: variation.reason,
      status: variation.status,
      createdAt: variation.createdAt.toISOString(),
      review: variation.reviewedAt ? { reviewedById: variation.reviewedById, reviewedByRole: variation.reviewedBy?.role ?? null, reviewedAt: variation.reviewedAt.toISOString() } : null,
      originalState: variation.originalState,
      proposedState: variation.proposedState,
      milestone: variation.milestone,
      evidence: variation.evidence,
      previousProof: toRelatedProof(variation.previousEvent),
      variationProof: toRelatedProof(variation.variationEvent),
      resolutions: variation.resolutions.map((resolution) => ({
        id: resolution.id,
        status: resolution.status,
        decision: resolution.decision,
        note: resolution.note,
        resolvedById: resolution.resolvedById,
        resolvedByRole: resolution.resolvedBy.role,
        createdAt: resolution.createdAt.toISOString(),
      })),
    })),
    blockchainProofs,
  };
}

export const passportService = {
  async list(actor: PublicUser) {
    const rows = await passportRepository.findAccessible(projectListWhere(actor));
    return rows.map(projectPassport);
  },

  async getByProjectId(actor: PublicUser, projectId: string) {
    // This helper preserves the established 404-for-missing / 403-for-inaccessible detail contract.
    await assertCanReadProject(actor, projectId);
    const row = await passportRepository.findById(projectId);
    if (!row) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
    }
    return projectPassport(row);
  },
};
