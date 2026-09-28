import { evidenceRepository } from "../repositories/evidence.repository";
import { contractorRepository } from "../repositories/contractor.repository";
import { projectRepository } from "../repositories/project.repository";
import { ApiError } from "../http/errors";
import type { PublicUser } from "../types";
import { verificationService } from "./evidence";
import type { CompareInput, CompareTargetInput, VerificationView } from "./evidence/types";
import { proofService, type ProofView } from "./proof.service";

export type InternalVerificationResult = {
  verification: VerificationView;
  proof: ProofView | null;
};

/**
 * Application boundary for INTERNAL verification HTTP.
 * Fingerprint compare stays in VerificationService; chain anchoring is here.
 */
export const verificationApplication = {
  async createInternal(
    actor: PublicUser,
    input: {
      evidenceId?: string;
      evidenceVersionId?: string;
      presentedBytes?: Buffer;
    },
  ): Promise<InternalVerificationResult> {
    const compareInput: CompareInput | CompareTargetInput = input.presentedBytes
      ? {
          presentedBytes: input.presentedBytes,
          evidenceId: input.evidenceId,
          evidenceVersionId: input.evidenceVersionId,
          source: "INTERNAL",
          requestedById: actor.id,
        }
      : {
          evidenceId: input.evidenceId,
          evidenceVersionId: input.evidenceVersionId,
          source: "INTERNAL",
          requestedById: actor.id,
        };

    const verification = input.presentedBytes
      ? await verificationService.compare(compareInput as CompareInput)
      : await verificationService.compareStored(compareInput);

    if (verification.status !== "MATCH" || !verification.evidenceVersionId || !verification.sha256) {
      return { verification, proof: null };
    }

    const context = await resolveEvidenceContext(
      verification.evidenceId,
      verification.evidenceVersionId,
    );
    if (!context) {
      return { verification, proof: null };
    }

    const proof = await proofService.anchorInternalMatch({
      projectId: context.projectId,
      contractorId: context.contractorId,
      milestoneId: context.milestoneId,
      evidenceVersionId: verification.evidenceVersionId,
      evidenceHash: verification.sha256,
      actorId: actor.id,
    });

    return { verification, proof };
  },
};

async function resolveEvidenceContext(
  evidenceId: string | null,
  evidenceVersionId: string,
): Promise<{ projectId: string; contractorId: string; milestoneId: string } | null> {
  if (!evidenceId) {
    return null;
  }
  const evidence = await evidenceRepository.findById(evidenceId);
  if (!evidence) {
    throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
  }
  const milestone = await projectRepository.getMilestoneById(evidence.milestoneId);
  if (!milestone) {
    throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
  }
  const project = await projectRepository.getProjectById(milestone.projectId);
  if (!project) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
  }
  const contractor = await contractorRepository.getContractorById(project.contractorId);
  if (!contractor) {
    throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
  }
  if (evidence.currentVersionId && evidence.currentVersionId !== evidenceVersionId) {
    // Anchoring uses the compared version id from the verification result.
  }
  return {
    projectId: project.id,
    contractorId: contractor.id,
    milestoneId: milestone.id,
  };
}
