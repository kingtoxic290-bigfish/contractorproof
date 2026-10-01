import type { PublicUser } from "../types/auth";
import type { PublicContractor } from "../features/contractors/types";
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
