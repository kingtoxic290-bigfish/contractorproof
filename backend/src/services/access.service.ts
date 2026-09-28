import { Role, type Prisma } from "@prisma/client";
import { contractorRepository } from "../repositories/contractor.repository";
import { evidenceRepository } from "../repositories/evidence.repository";
import { evidenceVersionRepository } from "../repositories/evidenceVersion.repository";
import { projectRepository } from "../repositories/project.repository";
import { ApiError } from "../http/errors";
import type { PublicUser } from "../types";

/**
 * HTTP-boundary application of the frozen contracts.md matrix.
 * Agent 6 owns official ownership helpers; those are not shipped yet.
 * This module does not invent new roles or a second policy engine.
 */
const PRIVILEGED_READ_ROLES: Role[] = [
  Role.ADMIN,
  Role.AUDITOR,
  Role.PROCUREMENT_OFFICER,
];

async function ownerUserIdForProject(projectId: string): Promise<string | null> {
  const project = await projectRepository.getProjectById(projectId);
  if (!project) {
    return null;
  }
  const contractor = await contractorRepository.getContractorById(project.contractorId);
  return contractor?.userId ?? null;
}

function deny(): never {
  throw new ApiError(403, "FORBIDDEN", "insufficient permission");
}

export async function assertCanWriteProject(actor: PublicUser, projectId: string): Promise<void> {
  if (actor.role === Role.ADMIN) {
    const project = await projectRepository.getProjectById(projectId);
    if (!project) {
      throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
    }
    return;
  }
  if (actor.role !== Role.CONTRACTOR) {
    deny();
  }
  const ownerUserId = await ownerUserIdForProject(projectId);
  if (!ownerUserId) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
  }
  if (ownerUserId !== actor.id) {
    deny();
  }
}

export async function assertCanReadProject(actor: PublicUser, projectId: string): Promise<void> {
  const project = await projectRepository.getProjectById(projectId);
  if (!project) {
    throw new ApiError(404, "PROJECT_NOT_FOUND", "project not found");
  }
  if (PRIVILEGED_READ_ROLES.includes(actor.role)) {
    return;
  }
  if (actor.role === Role.CONTRACTOR) {
    const ownerUserId = await ownerUserIdForProject(projectId);
    if (!ownerUserId || ownerUserId !== actor.id) {
      deny();
    }
    return;
  }
  deny();
}

export async function assertCanReadContractor(
  actor: PublicUser,
  contractorId: string,
): Promise<void> {
  const contractor = await contractorRepository.getContractorById(contractorId);
  if (!contractor) {
    throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
  }
  if (PRIVILEGED_READ_ROLES.includes(actor.role)) {
    return;
  }
  if (actor.role === Role.CONTRACTOR && contractor.userId === actor.id) {
    return;
  }
  deny();
}

/**
 * SQL where-clause for GET /projects. Same matrix as evidence list.
 */
export function projectListWhere(actor: PublicUser): Prisma.ProjectWhereInput {
  if (PRIVILEGED_READ_ROLES.includes(actor.role)) {
    return {};
  }
  if (actor.role === Role.CONTRACTOR) {
    return { contractor: { userId: actor.id } };
  }
  return { id: { in: [] } };
}

/**
 * SQL where-clause for GET /contractors. Same matrix as project list.
 */
export function contractorListWhere(actor: PublicUser): Prisma.ContractorWhereInput {
  if (PRIVILEGED_READ_ROLES.includes(actor.role)) {
    return {};
  }
  if (actor.role === Role.CONTRACTOR) {
    return { userId: actor.id };
  }
  return { id: { in: [] } };
}

export async function assertCanWriteMilestone(
  actor: PublicUser,
  milestoneId: string,
): Promise<void> {
  const milestone = await projectRepository.getMilestoneById(milestoneId);
  if (actor.role === Role.ADMIN) {
    if (!milestone) {
      throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
    }
    return;
  }
  if (actor.role !== Role.CONTRACTOR) {
    deny();
  }
  if (!milestone) {
    deny();
  }
  await assertCanWriteProject(actor, milestone.projectId);
}

/**
 * SQL where-clause for GET /evidence. Roles with no project relationship
 * receive an empty match (`id IN []`) so inaccessible rows are never loaded.
 */
export function evidenceListWhere(
  actor: PublicUser,
  filters: { milestoneId?: string; projectId?: string } = {},
): Prisma.EvidenceWhereInput {
  if (!PRIVILEGED_READ_ROLES.includes(actor.role) && actor.role !== Role.CONTRACTOR) {
    return { id: { in: [] } };
  }

  const access: Prisma.EvidenceWhereInput =
    actor.role === Role.CONTRACTOR
      ? {
          milestone: {
            project: {
              contractor: { userId: actor.id },
            },
          },
        }
      : {};

  const extra: Prisma.EvidenceWhereInput[] = [];
  if (filters.milestoneId) {
    extra.push({ milestoneId: filters.milestoneId });
  }
  if (filters.projectId) {
    extra.push({ milestone: { projectId: filters.projectId } });
  }

  if (extra.length === 0) {
    return access;
  }
  return { AND: [access, ...extra] };
}

/** SQL where-clause for GET /attestations, scoped by project access. */
export function attestationListWhere(
  actor: PublicUser,
  filters: { milestoneId?: string; projectId?: string; evidenceId?: string } = {},
): Prisma.AttestationWhereInput {
  if (!PRIVILEGED_READ_ROLES.includes(actor.role) && actor.role !== Role.CONTRACTOR) {
    return { id: { in: [] } };
  }

  const access: Prisma.AttestationWhereInput =
    actor.role === Role.CONTRACTOR
      ? {
          milestone: {
            project: {
              contractor: { userId: actor.id },
            },
          },
        }
      : {};

  const extra: Prisma.AttestationWhereInput[] = [];
  if (filters.milestoneId) {
    extra.push({ milestoneId: filters.milestoneId });
  }
  if (filters.projectId) {
    extra.push({ milestone: { projectId: filters.projectId } });
  }
  if (filters.evidenceId) {
    extra.push({ evidenceId: filters.evidenceId });
  }

  if (extra.length === 0) {
    return access;
  }
  return { AND: [access, ...extra] };
}

/**
 * SQL where-clause for GET /disputes. Same project-access matrix as evidence list.
 * Roles with no project relationship receive an empty match.
 */
export function disputeListWhere(
  actor: PublicUser,
  filters: { milestoneId?: string; projectId?: string } = {},
): Prisma.DisputeWhereInput {
  if (!PRIVILEGED_READ_ROLES.includes(actor.role) && actor.role !== Role.CONTRACTOR) {
    return { id: { in: [] } };
  }

  const access: Prisma.DisputeWhereInput =
    actor.role === Role.CONTRACTOR
      ? {
          milestone: {
            project: {
              contractor: { userId: actor.id },
            },
          },
        }
      : {};

  const extra: Prisma.DisputeWhereInput[] = [];
  if (filters.milestoneId) {
    extra.push({ milestoneId: filters.milestoneId });
  }
  if (filters.projectId) {
    extra.push({ milestone: { projectId: filters.projectId } });
  }

  if (extra.length === 0) {
    return access;
  }
  return { AND: [access, ...extra] };
}

/**
 * SQL where-clause for GET /corrections. Same project-access matrix as disputes.
 */
export function correctionListWhere(
  actor: PublicUser,
  filters: { milestoneId?: string; projectId?: string } = {},
): Prisma.CorrectionWhereInput {
  if (!PRIVILEGED_READ_ROLES.includes(actor.role) && actor.role !== Role.CONTRACTOR) {
    return { id: { in: [] } };
  }

  const access: Prisma.CorrectionWhereInput =
    actor.role === Role.CONTRACTOR
      ? {
          milestone: {
            project: {
              contractor: { userId: actor.id },
            },
          },
        }
      : {};

  const extra: Prisma.CorrectionWhereInput[] = [];
  if (filters.milestoneId) {
    extra.push({ milestoneId: filters.milestoneId });
  }
  if (filters.projectId) {
    extra.push({ milestone: { projectId: filters.projectId } });
  }

  if (extra.length === 0) {
    return access;
  }
  return { AND: [access, ...extra] };
}

export async function assertCanReadMilestone(
  actor: PublicUser,
  milestoneId: string,
): Promise<void> {
  const milestone = await projectRepository.getMilestoneById(milestoneId);
  if (!milestone) {
    throw new ApiError(404, "MILESTONE_NOT_FOUND", "milestone not found");
  }
  await assertCanReadProject(actor, milestone.projectId);
}

export async function assertCanReadEvidence(
  actor: PublicUser,
  evidenceId: string,
): Promise<void> {
  const evidence = await evidenceRepository.findById(evidenceId);
  if (!evidence) {
    throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
  }
  await assertCanReadMilestone(actor, evidence.milestoneId);
}

export async function assertCanWriteEvidence(
  actor: PublicUser,
  evidenceId: string,
): Promise<void> {
  const evidence = await evidenceRepository.findById(evidenceId);
  if (!evidence) {
    throw new ApiError(404, "EVIDENCE_NOT_FOUND", "evidence not found");
  }
  await assertCanWriteMilestone(actor, evidence.milestoneId);
}

export async function assertCanReadVersion(
  actor: PublicUser,
  evidenceVersionId: string,
): Promise<void> {
  const version = await evidenceVersionRepository.findById(evidenceVersionId);
  if (!version) {
    throw new ApiError(404, "VERSION_NOT_FOUND", "evidence version not found");
  }
  await assertCanReadEvidence(actor, version.evidenceId);
}

export async function assertCanAccessVerificationTarget(
  actor: PublicUser,
  target: { evidenceId?: string; evidenceVersionId?: string },
): Promise<void> {
  if (target.evidenceVersionId) {
    await assertCanReadVersion(actor, target.evidenceVersionId);
    if (target.evidenceId) {
      const version = await evidenceVersionRepository.findById(target.evidenceVersionId);
      if (!version || version.evidenceId !== target.evidenceId) {
        throw new ApiError(404, "VERSION_NOT_FOUND", "evidence version not found");
      }
    }
    return;
  }
  if (target.evidenceId) {
    await assertCanReadEvidence(actor, target.evidenceId);
    return;
  }
  throw new ApiError(400, "VALIDATION_ERROR", "evidenceId or evidenceVersionId is required");
}

/**
 * Internal fingerprint compare is not attestation and is not public verify.
 * CONTRACTOR is never a verifier. Project access still applies.
 * CLIENT / CONSULTANT_ENGINEER have no membership model yet, so they fail
 * the existing project-access check rather than a new membership table.
 */
export const assertCanAccessProject = assertCanReadProject;
export const assertCanAccessMilestone = assertCanReadMilestone;
export const assertCanAccessEvidence = assertCanReadEvidence;
export const assertOwnership = assertCanWriteProject;

export async function assertCanCreateVerification(
  actor: PublicUser,
  target: { evidenceId?: string; evidenceVersionId?: string },
): Promise<void> {
  if (actor.role === Role.CONTRACTOR) {
    deny();
  }
  await assertCanAccessVerificationTarget(actor, target);
}
