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

function projectPassport(row: PassportProjectRow) {
  const blockchainProofs = row.blockchainEvents.map(toPassportProof);
  const proofFor = (eventType: BlockchainEventType, referenceId: string) =>
    blockchainProofs.find(
      (proof) => proof.eventType === eventType && proof.referenceId === referenceId,
    ) ?? null;

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
