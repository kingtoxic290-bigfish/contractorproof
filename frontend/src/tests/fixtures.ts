import type { PublicUser } from "../types/auth";
import type { PublicContractor, ContractorPassport } from "../features/contractors/types";
import type { PublicEvidence } from "../features/evidence/types";
import type { PublicMilestone } from "../features/milestones/types";
import type { PublicProject } from "../features/projects/types";
import type { PublicAttestation, PublicVerification } from "../features/verification/types";

export function contractorRecord(
  overrides: Partial<Omit<PublicContractor, "user">> &
    Pick<PublicContractor, "id" | "legalName"> & { user?: Partial<PublicUser> },
): PublicContractor {
  const userId = overrides.userId ?? `user-${overrides.id}`;
  const { user, ...rest } = overrides;
  return {
    userId,
    crbRegistrationNumber: null,
    crbCategory: null,
    crbType: null,
    crbClass: null,
    crbStatus: null,
    crbLastVerifiedAt: null,
    crbSource: "SYNTHETIC_DEMO",
    createdAt: "2026-09-24T07:49:43.000Z",
    updatedAt: "2026-09-24T07:49:43.000Z",
    user: {
      id: userId,
      email: `${overrides.id}@example.com`,
      fullName: overrides.legalName,
      role: "CONTRACTOR",
      ...user,
    },
    ...rest,
  };
}

export function projectRecord(
  overrides: Partial<PublicProject> & Pick<PublicProject, "id" | "name">,
): PublicProject {
  return {
    clientId: null,
    clientName: null,
    contractorId: "contractor-1",
    contractorName: "Demo Contractor Ltd",
    contractorCrbRegistrationNumber: null,
    description: null,
    nestTenderReference: null,
    nestContractReference: null,
    ocid: null,
    procuringEntity: null,
    contractStatus: null,
    contractStartDate: null,
    contractEndDate: null,
    nestSource: "SYNTHETIC_DEMO",
    createdAt: "2026-09-24T07:49:43.000Z",
    updatedAt: "2026-09-24T07:49:43.000Z",
    ...overrides,
  };
}

export function evidenceRecord(
  overrides: Partial<PublicEvidence> & Pick<PublicEvidence, "id" | "fileName">,
): PublicEvidence {
  const versionId = overrides.currentVersionId ?? `version-${overrides.id}`;
  return {
    milestoneId: "11111111-1111-4111-8111-111111111111",
    currentVersionId: versionId,
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    mimeType: "image/jpeg",
    sizeBytes: 12,
    status: "PENDING_VERIFICATION",
    verificationStatus: "PENDING",
    createdAt: "2026-09-24T07:49:43.000Z",
    updatedAt: "2026-09-24T07:49:43.000Z",
    currentVersion: {
      id: versionId,
      evidenceId: overrides.id,
      versionNumber: 1,
      sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      fileName: overrides.fileName,
      mimeType: "image/jpeg",
      sizeBytes: 12,
      createdAt: "2026-09-24T07:49:43.000Z",
    },
    ...overrides,
  };
}

export function verificationRecord(
  overrides: Partial<PublicVerification> & Pick<PublicVerification, "status">,
): PublicVerification {
  return {
    id: "verification-1",
    source: "INTERNAL",
    evidenceId: "e1",
    evidenceVersionId: "version-e1",
    sha256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    createdAt: "2026-09-24T07:49:43.000Z",
    proof: null,
    ...overrides,
  };
}

export function attestationRecord(
  overrides: Partial<PublicAttestation> & Pick<PublicAttestation, "decision">,
): PublicAttestation {
  return {
    id: "attestation-1",
    evidenceId: "e1",
    milestoneId: "22222222-2222-4222-8222-222222222222",
    verifierRole: "AUDITOR",
    comment: null,
    createdAt: "2026-09-24T07:49:43.000Z",
    ...overrides,
  };
}

export function milestoneRecord(
  overrides: Partial<PublicMilestone> & Pick<PublicMilestone, "id" | "name" | "status">,
): PublicMilestone {
  return {
    projectId: "project-1",
    policyId: null,
    description: null,
    createdAt: "2026-09-24T07:49:43.000Z",
    updatedAt: "2026-09-24T07:49:43.000Z",
    ...overrides,
  };
}

/** Mirrors the GET /contractors/:contractorId/passport projection exactly. */
export function contractorPassportFixture(
  overrides: Partial<ContractorPassport> = {},
): ContractorPassport {
  return {
    scope: {
      viewerRole: "CLIENT",
      isOwnPassport: false,
      contractorProjectCount: 1,
      withheldProjectDetailCount: 0,
      milestoneCompletionBasis:
        "A project is counted as fully verified only when every milestone it owns has status VERIFIED.",
      containsRatings: false,
    },
    contractor: {
      id: "c1",
      legalName: "Harbor Works Ltd",
      crbRegistrationNumber: "CRB-204",
      crbCategory: "Works",
      crbType: "Building",
      crbClass: "Class I",
      crbStatus: "REGISTERED",
      crbLastVerifiedAt: "2026-09-24T07:49:43.000Z",
      crbSource: "SANDBOX",
      createdAt: "2026-09-24T07:49:43.000Z",
      updatedAt: "2026-09-24T07:49:43.000Z",
      account: {
        userId: "user-c1",
        fullName: "Harbor Works Ltd",
        role: "CONTRACTOR",
        registeredAt: "2026-09-24T07:49:43.000Z",
      },
    },
    crbRegistrations: {
      checkCount: 1,
      latest: {
        id: "crb-check-1",
        registrationReference: "CRB-204",
        status: "REGISTERED",
        source: "SANDBOX",
        registrationNumber: "CRB-204",
        registeredName: "Harbor Works Ltd",
        category: "Works",
        registrationClass: "Class I",
        registrationDate: "2020-01-01T00:00:00.000Z",
        expiryDate: "2027-01-01T00:00:00.000Z",
        externalReference: null,
        checkedAt: "2026-09-24T07:49:43.000Z",
        canonicalDigest: "a".repeat(64),
        failureCode: null,
        requestedById: null,
      },
      history: [],
    },
    totals: {
      projects: 1,
      projectsWithAllMilestonesVerified: 0,
      projectsWithUnverifiedMilestones: 1,
      projectsWithoutMilestones: 0,
      milestones: { PENDING: 0, IN_PROGRESS: 0, PENDING_VERIFICATION: 0, VERIFIED: 1, REJECTED: 0 },
      evidence: { PENDING_VERIFICATION: 0, VERIFIED: 1, REJECTED: 0 },
      attestations: { APPROVED: 1, REJECTED: 0 },
      verification: { MATCH: 1, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 },
      disputes: { OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, REJECTED: 0 },
      corrections: { OPEN: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 },
      blockchainProofs: { total: 2, confirmed: 1, pending: 1 },
    },
    projects: [
      {
        id: "project-1",
        name: "Bridge deck",
        description: "Deck replacement",
        clientId: "client-1",
        clientName: "Demo Client",
        clientVisible: true,
        contractStatus: "ACTIVE",
        contractStartDate: "2026-01-01T00:00:00.000Z",
        contractEndDate: "2026-12-31T00:00:00.000Z",
        procuringEntity: "Demo Procuring Entity",
        nestTenderReference: "TN-204",
        nestContractReference: "CT-204",
        ocid: null,
        createdAt: "2026-01-02T00:00:00.000Z",
        milestones: [
          {
            id: "milestone-1",
            name: "Foundation",
            status: "VERIFIED",
            createdAt: "2026-01-03T00:00:00.000Z",
            updatedAt: "2026-02-01T00:00:00.000Z",
            evidence: {
              total: 1,
              byStatus: { PENDING_VERIFICATION: 0, VERIFIED: 1, REJECTED: 0 },
              attestations: { APPROVED: 1, REJECTED: 0 },
              verification: { MATCH: 1, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 },
            },
            corrections: {
              total: 0,
              byStatus: { OPEN: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 },
            },
            disputes: {
              total: 0,
              byStatus: { OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, REJECTED: 0 },
            },
          },
        ],
        milestoneStatus: {
          total: 1,
          byStatus: { PENDING: 0, IN_PROGRESS: 0, PENDING_VERIFICATION: 0, VERIFIED: 1, REJECTED: 0 },
          allVerified: true,
          withUnverified: false,
        },
        evidence: { total: 1, byStatus: { PENDING_VERIFICATION: 0, VERIFIED: 1, REJECTED: 0 } },
        attestations: { APPROVED: 1, REJECTED: 0 },
        verification: { MATCH: 1, MISMATCH: 0, PENDING: 0, UNAVAILABLE: 0 },
        disputes: { total: 0, byStatus: { OPEN: 0, UNDER_REVIEW: 0, RESOLVED: 0, REJECTED: 0 } },
        corrections: {
          total: 0,
          byStatus: { OPEN: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 },
        },
        proof: { total: 2, confirmed: 1, pending: 1 },
      },
    ],
    ...overrides,
  };
}
