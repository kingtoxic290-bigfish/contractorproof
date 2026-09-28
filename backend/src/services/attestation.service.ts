import { AttestationDecision, Role, type Attestation, type Prisma } from "@prisma/client";
import { evidenceRepository } from "../repositories/evidence.repository";
import { projectRepository } from "../repositories/project.repository";
import { contractorRepository } from "../repositories/contractor.repository";
import { prisma } from "../repositories/prisma";
import { ApiError } from "../http/errors";
import { ATTEST_ROLES, type PublicUser } from "../types";
import { assertCanReadProject, attestationListWhere } from "./access.service";
import { proofService, type ProofView } from "./proof.service";

export const ATTEST_ERROR_CODES = {
  CONTRACTOR_ATTEST_FORBIDDEN: "CONTRACTOR_ATTEST_FORBIDDEN",
  UPLOADER_ATTEST_FORBIDDEN: "UPLOADER_ATTEST_FORBIDDEN",
  OWNER_ATTEST_FORBIDDEN: "OWNER_ATTEST_FORBIDDEN",
  ROLE_NOT_ALLOWED: "ROLE_NOT_ALLOWED",
} as const;

export function assertCanAttest(params: {
  actor: PublicUser;
  evidenceUploaderId: string;
  contractorUserId?: string;
  allowedRoles?: Role[];
}): void {
  if (params.actor.role === Role.CONTRACTOR) {
    throw new ApiError(
      403,
      ATTEST_ERROR_CODES.CONTRACTOR_ATTEST_FORBIDDEN,
      "a contractor cannot verify or attest evidence",
    );
  }

  if (params.actor.id === params.evidenceUploaderId) {
    throw new ApiError(
      403,
      ATTEST_ERROR_CODES.UPLOADER_ATTEST_FORBIDDEN,
      "a user cannot attest evidence they uploaded",
    );
  }

  if (params.contractorUserId && params.actor.id === params.contractorUserId) {
    throw new ApiError(
      403,
      ATTEST_ERROR_CODES.OWNER_ATTEST_FORBIDDEN,
      "a contractor cannot attest their own evidence",
    );
  }

  const allowed =
    params.allowedRoles && params.allowedRoles.length > 0
      ? params.allowedRoles
      : [...ATTEST_ROLES];
  if (!allowed.includes(params.actor.role)) {
    throw new ApiError(
      403,
      ATTEST_ERROR_CODES.ROLE_NOT_ALLOWED,
      "role is not allowed to attest this evidence",
    );
  }
}

function toAttestationView(row: Attestation) {
  return {
    id: row.id,
    evidenceId: row.evidenceId,
    milestoneId: row.milestoneId,
    decision: row.decision,
    verifierRole: row.verifierRole,
    comment: row.comment,
    createdAt: row.createdAt.toISOString(),
  };
}

export const attestationService = {
  assertCanAttest,

  async create(input: {
    actor: PublicUser;
    evidenceId: string;
    milestoneId: string;
    decision: AttestationDecision;
    comment?: string;
  }): Promise<{ attestation: ReturnType<typeof toAttestationView>; proof: ProofView | null }> {
    const evidence = await evidenceRepository.findById(input.evidenceId);
    if (!evidence) {
      throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
    }
    if (evidence.milestoneId !== input.milestoneId) {
      throw new ApiError(400, "VALIDATION_ERROR", "evidence does not belong to milestone");
    }
    if (!evidence.sha256 || !evidence.currentVersionId) {
      throw new ApiError(400, "VALIDATION_ERROR", "evidence has no authoritative fingerprint");
    }

    const milestone = await projectRepository.getMilestoneById(input.milestoneId);
    if (!milestone) {
      throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
    }

    await assertCanReadProject(input.actor, milestone.projectId);

    const project = await projectRepository.getProjectById(milestone.projectId);
    if (!project) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
    }
    const contractor = await contractorRepository.getContractorById(project.contractorId);

    let allowedRoles: Role[] | undefined;
    if (milestone.policyId) {
      const policy = await prisma.verificationPolicy.findUnique({
        where: { id: milestone.policyId },
      });
      allowedRoles = policy?.allowedRoles;
    }

    assertCanAttest({
      actor: input.actor,
      evidenceUploaderId: evidence.uploadedById,
      contractorUserId: contractor?.userId,
      allowedRoles,
    });

    let row: Attestation;
    try {
      row = await prisma.attestation.create({
        data: {
          milestoneId: milestone.id,
          evidenceId: evidence.id,
          verifierId: input.actor.id,
          verifierRole: input.actor.role,
          decision: input.decision,
          comment: input.comment?.trim() || null,
        },
      });
    } catch (error) {
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: string }).code === "P2002"
      ) {
        throw new ApiError(409, "CONFLICT", "this verifier has already attested this evidence");
      }
      throw error;
    }

    try {
      const anchored = await proofService.anchorAttestation({
        attestation: row,
        projectId: project.id,
        contractorId: project.contractorId,
        milestoneId: milestone.id,
        evidenceVersionId: evidence.currentVersionId,
        evidenceHash: evidence.sha256,
      });
      return {
        attestation: toAttestationView(row),
        proof: anchored.attestationProof,
      };
    } catch (error) {
      // Refuse-closed when the registry is writable: roll back the attestation so retries work.
      await prisma.attestation.delete({ where: { id: row.id } }).catch(() => undefined);
      throw error;
    }
  },

  async list(
    actor: PublicUser,
    filters: { milestoneId?: string; projectId?: string; evidenceId?: string } = {},
  ) {
    const where = attestationListWhere(actor, filters);
    const rows = await prisma.attestation.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
    return rows.map(toAttestationView);
  },
};
