import {
  AttestationDecision,
  CorrectionStatus,
  DisputeStatus,
  EvidenceStatus,
  MilestoneStatus,
  Role,
  VerificationStatus,
} from "@prisma/client";
import { ApiError } from "../http/errors";
import type { PublicUser } from "../types";
import { assertCanReadContractor } from "./access.service";
import {
  contractorPassportRepository,
  type ContractorPassportRow,
} from "../repositories/passport.repository";

/**
 * Live Contractor Passport.
 *
 * Everything returned here is a recorded fact: a count, an enum value, a
 * timestamp or a SHA-256 digest that already exists in the ledger or the
 * database. There is no derived rating, ranking, recommendation or score, and
 * no field is inferred from a contractor's identity.
 */

type Counter = Record<string, number>;

function emptyCounter<T extends string>(values: readonly T[]): Record<T, number> {
  return Object.fromEntries(values.map((value) => [value, 0])) as Record<T, number>;
}

function tally<T extends string>(target: Record<T, number>, value: T): void {
  target[value] = (target[value] ?? 0) + 1;
}

function accumulate<T extends string>(
  target: Record<T, number>,
  counts: Record<string, number>,
  cast: (value: string) => T,
): void {
  for (const [value, count] of Object.entries(counts)) {
    const key = cast(value);
    target[key] = (target[key] ?? 0) + count;
  }
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function isConfirmed(txHash: string | null, blockNumber: number | null): boolean {
  return Boolean(txHash) && blockNumber != null && blockNumber > 0;
}

const MILESTONE_STATUSES = Object.values(MilestoneStatus);
const EVIDENCE_STATUSES = Object.values(EvidenceStatus);
const VERIFICATION_STATUSES = Object.values(VerificationStatus);
const DISPUTE_STATUSES = Object.values(DisputeStatus);
const CORRECTION_STATUSES = Object.values(CorrectionStatus);
const ATTESTATION_DECISIONS = Object.values(AttestationDecision);

const asMilestoneStatus = (value: string) => value as MilestoneStatus;
const asEvidenceStatus = (value: string) => value as EvidenceStatus;
const asAttestationDecision = (value: string) => value as AttestationDecision;
const asVerificationStatus = (value: string) => value as VerificationStatus;
const asDisputeStatus = (value: string) => value as DisputeStatus;
const asCorrectionStatus = (value: string) => value as CorrectionStatus;

/** Roles that may read any contractor record, matching assertCanReadContractor. */
const PRIVILEGED_PASSPORT_ROLES: Role[] = [
  Role.ADMIN,
  Role.AUDITOR,
  Role.PROCUREMENT_OFFICER,
];

type EvidenceRow = ContractorPassportRow["projects"][number]["milestones"][number]["evidence"][number];

function evidenceCounts(evidenceRows: EvidenceRow[]) {
  const byStatus = emptyCounter(EVIDENCE_STATUSES);
  const attestations = emptyCounter(ATTESTATION_DECISIONS);
  const verification = emptyCounter(VERIFICATION_STATUSES);

  for (const evidence of evidenceRows) {
    tally(byStatus, evidence.status);
    for (const attestation of evidence.attestations) {
      tally(attestations, attestation.decision);
    }
    for (const version of evidence.versions) {
      for (const record of version.verifications) {
        tally(verification, record.status);
      }
    }
  }

  return { total: evidenceRows.length, byStatus, attestations, verification };
}

type MilestoneRow = ContractorPassportRow["projects"][number]["milestones"][number];

type MilestoneHistoryRow = Awaited<ReturnType<typeof contractorPassportRepository.listMilestoneStatusHistory>>[number];

function milestoneView(row: MilestoneRow, statusHistory: MilestoneHistoryRow[]) {
  const evidence = evidenceCounts(row.evidence);
  const corrections = emptyCounter(CORRECTION_STATUSES);
  for (const correction of row.corrections) {
    tally(corrections, correction.status);
  }
  const disputes = emptyCounter(DISPUTE_STATUSES);
  for (const dispute of row.disputes) {
    tally(disputes, dispute.status);
  }

  return {
    id: row.id,
    name: row.name,
    status: row.status,
    statusHistory: statusHistory.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      evidenceId: entry.evidenceId,
      isBaseline: entry.isBaseline,
      createdAt: entry.createdAt.toISOString(),
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    evidence,
    corrections: { total: row.corrections.length, byStatus: corrections },
    disputes: { total: row.disputes.length, byStatus: disputes },
  };
}

type ProjectRow = ContractorPassportRow["projects"][number];
type ProjectHistoryRow = Awaited<ReturnType<typeof contractorPassportRepository.listProjectStatusHistory>>[number];

/**
 * A project is only described as fully verified when every milestone it owns is
 * VERIFIED. The service states that basis explicitly instead of inventing a
 * separate project lifecycle the schema does not have.
 */
function projectView(
  row: ProjectRow,
  viewer: PublicUser,
  lifecycleHistory: ProjectHistoryRow[],
  milestoneHistory: MilestoneHistoryRow[],
) {
  const privileged = PRIVILEGED_PASSPORT_ROLES.includes(viewer.role);
  const ownedByViewer = viewer.role === Role.CLIENT && row.client?.id === viewer.id;
  // Another client's project narrative and client identity are not part of a
  // contractor's public-facing record.
  const clientVisible = privileged || ownedByViewer;

  const statusHistoryByMilestone = new Map<string, MilestoneHistoryRow[]>();
  for (const entry of milestoneHistory) {
    const history = statusHistoryByMilestone.get(entry.milestoneId) ?? [];
    history.push(entry);
    statusHistoryByMilestone.set(entry.milestoneId, history);
  }
  const milestones = row.milestones.map((milestone) =>
    milestoneView(milestone, statusHistoryByMilestone.get(milestone.id) ?? []),
  );
  const milestoneStatus = emptyCounter(MILESTONE_STATUSES);
  for (const milestone of milestones) {
    tally(milestoneStatus, milestone.status);
  }

  const evidenceByStatus = emptyCounter(EVIDENCE_STATUSES);
  const attestations = emptyCounter(ATTESTATION_DECISIONS);
  const verification = emptyCounter(VERIFICATION_STATUSES);
  const disputes = emptyCounter(DISPUTE_STATUSES);
  const corrections = emptyCounter(CORRECTION_STATUSES);
  let evidenceTotal = 0;
  let disputeTotal = 0;
  let correctionTotal = 0;

  for (const milestone of milestones) {
    evidenceTotal += milestone.evidence.total;
    disputeTotal += milestone.disputes.total;
    correctionTotal += milestone.corrections.total;
    accumulate(evidenceByStatus, milestone.evidence.byStatus, asEvidenceStatus);
    accumulate(attestations, milestone.evidence.attestations, asAttestationDecision);
    accumulate(verification, milestone.evidence.verification, asVerificationStatus);
    accumulate(disputes, milestone.disputes.byStatus, asDisputeStatus);
    accumulate(corrections, milestone.corrections.byStatus, asCorrectionStatus);
  }

  const proof = row.blockchainEvents.reduce(
    (accumulator, event) => {
      accumulator.total += 1;
      if (isConfirmed(event.txHash, event.blockNumber)) {
        accumulator.confirmed += 1;
      } else {
        accumulator.pending += 1;
      }
      return accumulator;
    },
    { total: 0, confirmed: 0, pending: 0 },
  );

  return {
    id: row.id,
    lifecycleStatus: row.lifecycleStatus,
    lifecycleHistory: lifecycleHistory.map((entry) => ({
      id: entry.id,
      sequence: entry.sequence,
      previousStatus: entry.previousStatus,
      newStatus: entry.newStatus,
      actorName: entry.actorName,
      actorRole: entry.actorRole,
      isBaseline: entry.isBaseline,
      createdAt: entry.createdAt.toISOString(),
    })),
    name: row.name,
    description: clientVisible ? row.description : null,
    clientName: clientVisible ? (row.client?.fullName ?? null) : null,
    clientVisible,
    contractStatus: row.contractStatus,
    contractStartDate: iso(row.contractStartDate),
    contractEndDate: iso(row.contractEndDate),
    procuringEntity: row.procuringEntity,
    nestTenderReference: row.nestTenderReference,
    nestContractReference: row.nestContractReference,
    ocid: row.ocid,
    createdAt: row.createdAt.toISOString(),
    milestones,
    milestoneStatus: {
      total: milestones.length,
      byStatus: milestoneStatus,
      allVerified:
        milestones.length > 0 && milestones.every((milestone) => milestone.status === MilestoneStatus.VERIFIED),
      withUnverified:
        milestones.some((milestone) => milestone.status !== MilestoneStatus.VERIFIED),
    },
    evidence: { total: evidenceTotal, byStatus: evidenceByStatus },
    attestations,
    verification,
    disputes: { total: disputeTotal, byStatus: disputes },
    corrections: { total: correctionTotal, byStatus: corrections },
    proof,
  };
}

function crbCheckView(
  row: ContractorPassportRow["crbVerifications"][number],
) {
  return {
    id: row.id,
    registrationReference: row.registrationReference,
    status: row.status,
    source: row.source,
    registrationNumber: row.registrationNumber,
    registeredName: row.registeredName,
    category: row.category,
    registrationClass: row.registrationClass,
    registrationDate: iso(row.registrationDate),
    expiryDate: iso(row.expiryDate),
    externalReference: row.externalReference,
    checkedAt: row.checkedAt.toISOString(),
    canonicalDigest: row.canonicalDigest,
    failureCode: row.failureCode,
  };
}

function toContractorPassport(
  row: ContractorPassportRow,
  viewer: PublicUser,
  lifecycleHistory: ProjectHistoryRow[],
  milestoneHistory: MilestoneHistoryRow[],
) {
  const historyByProject = new Map<string, ProjectHistoryRow[]>();
  for (const entry of lifecycleHistory) {
    const history = historyByProject.get(entry.projectId) ?? [];
    history.push(entry);
    historyByProject.set(entry.projectId, history);
  }
  const projects = row.projects.map((project) =>
    projectView(
      project,
      viewer,
      historyByProject.get(project.id) ?? [],
      milestoneHistory,
    ),
  );
  const withheldProjectDetails = projects.filter((project) => !project.clientVisible).length;

  const totals = {
    projects: projects.length,
    projectsWithAllMilestonesVerified: projects.filter((project) => project.milestoneStatus.allVerified).length,
    projectsWithUnverifiedMilestones: projects.filter((project) => project.milestoneStatus.withUnverified).length,
    projectsWithoutMilestones: projects.filter((project) => project.milestoneStatus.total === 0).length,
    projectsWithBlockchainProofs: projects.filter((project) => project.proof.total > 0).length,
  };

  const milestones = emptyCounter(MILESTONE_STATUSES);
  const evidence = emptyCounter(EVIDENCE_STATUSES);
  const attestations = emptyCounter(ATTESTATION_DECISIONS);
  const verification = emptyCounter(VERIFICATION_STATUSES);
  const disputes = emptyCounter(DISPUTE_STATUSES);
  const corrections = emptyCounter(CORRECTION_STATUSES);
  const proof = { total: 0, confirmed: 0, pending: 0 };

  for (const project of projects) {
    accumulate(milestones, project.milestoneStatus.byStatus, asMilestoneStatus);
    accumulate(evidence, project.evidence.byStatus, asEvidenceStatus);
    accumulate(attestations, project.attestations, asAttestationDecision);
    accumulate(verification, project.verification, asVerificationStatus);
    accumulate(disputes, project.disputes.byStatus, asDisputeStatus);
    accumulate(corrections, project.corrections.byStatus, asCorrectionStatus);
    proof.total += project.proof.total;
    proof.confirmed += project.proof.confirmed;
    proof.pending += project.proof.pending;
  }

  // The passport separates a contractor's closed, fully evidenced record from
  // work still in flight. The split is a view over the same projects already
  // loaded above: nothing is copied, re-fetched or stored a second time, and
  // a project appears in exactly one of the two lists.
  //
  // Membership is decided solely by milestone verification. The project's
  // workflow lifecycleStatus is deliberately NOT consulted: it records how the
  // contract is being administered, not whether the delivered work is
  // evidenced and verified, so treating COMPLETED as proof of completion would
  // put unverified work into the contractor's historical record.
  const verifiedHistory = projects.filter((project) => project.milestoneStatus.allVerified);
  const activeProjects = projects.filter((project) => !project.milestoneStatus.allVerified);

  return {
    scope: {
      viewerRole: viewer.role,
      isOwnPassport: row.userId === viewer.id,
      contractorProjectCount: totals.projects,
      withheldProjectDetailCount: withheldProjectDetails,
      milestoneCompletionBasis:
        "A project is counted as fully verified only when every milestone it owns has status VERIFIED.",
      verifiedHistoryBasis:
        "A project belongs to verifiedHistory only when it has at least one milestone and every milestone it owns has status VERIFIED. Verified history reflects delivered, verified work only; it never implies a rating, ranking, recommendation or judgement about the contractor, and it is independent of the project's lifecycleStatus.",
      containsRatings: false,
    },
    contractor: {
      id: row.id,
      legalName: row.legalName,
      crbRegistrationNumber: row.crbRegistrationNumber,
      crbCategory: row.crbCategory,
      crbType: row.crbType,
      crbClass: row.crbClass,
      crbStatus: row.crbStatus,
      crbLastVerifiedAt: iso(row.crbLastVerifiedAt),
      crbSource: row.crbSource,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    crbRegistrations: {
      checkCount: row.crbVerifications.length,
      latest: row.crbVerifications[0] ? crbCheckView(row.crbVerifications[0]) : null,
      history: row.crbVerifications.map(crbCheckView),
    },
    totals: {
      ...totals,
      verifiedHistory: verifiedHistory.length,
      activeProjects: activeProjects.length,
      milestones,
      evidence,
      attestations,
      verification,
      disputes,
      corrections,
      blockchainProofs: proof,
    },
    projects,
    // The same project objects, partitioned. `projects` stays so existing
    // consumers keep working; the two lists are for readers who need to tell a
    // finished record from work in progress.
    verifiedHistory,
    activeProjects,
  };
}

export const contractorPassportService = {
  async getByContractorId(
    actor: PublicUser,
    contractorId: string,
  ): Promise<ReturnType<typeof toContractorPassport>> {
    // Same read gate as GET /contractors/:id. A CONTRACTOR therefore reaches
    // exactly one passport: their own.
    await assertCanReadContractor(actor, contractorId);
    const row = await contractorPassportRepository.findByContractorId(contractorId);
    if (!row) {
      throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    }
    const lifecycleHistory = await contractorPassportRepository.listProjectStatusHistory(
      row.projects.map((project) => project.id),
    );
    const milestoneHistory = await contractorPassportRepository.listMilestoneStatusHistory(
      row.projects.flatMap((project) => project.milestones.map((milestone) => milestone.id)),
    );
    return toContractorPassport(row, actor, lifecycleHistory, milestoneHistory);
  },

  async getByActor(
    actor: PublicUser,
  ): Promise<ReturnType<typeof toContractorPassport>> {
    const row = await contractorPassportRepository.findByUserId(actor.id);
    if (!row) {
      throw new ApiError(404, "CONTRACTOR_NOT_FOUND", "contractor not found");
    }
    const lifecycleHistory = await contractorPassportRepository.listProjectStatusHistory(
      row.projects.map((project) => project.id),
    );
    const milestoneHistory = await contractorPassportRepository.listMilestoneStatusHistory(
      row.projects.flatMap((project) => project.milestones.map((milestone) => milestone.id)),
    );
    return toContractorPassport(row, actor, lifecycleHistory, milestoneHistory);
  },
};