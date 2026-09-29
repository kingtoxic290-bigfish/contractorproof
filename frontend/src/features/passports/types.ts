export const VERIFICATION_STATES = ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export type PassportProof = {
  id: string;
  eventType: string;
  referenceId: string | null;
  evidenceHash?: string | null;
  txHash: string | null;
  blockNumber: number | null;
  confirmationState: "CONFIRMED" | "PENDING";
  confirmed: boolean;
  createdAt: string;
};

export type PassportVerification = {
  id: string;
  status: VerificationState;
  source: string;
  createdAt: string;
};

export type PassportVersion = {
  id: string;
  versionNumber: number;
  sha256: string;
  createdAt: string;
  verificationStatus: VerificationState | null;
  verifications: PassportVerification[];
  blockchainProof: PassportProof | null;
};

export type PassportAttestation = {
  id: string;
  evidenceId: string;
  milestoneId: string;
  policyId: string | null;
  decision: string;
  verifierRole: string;
  createdAt: string;
  blockchainProof: PassportProof | null;
};

export type PassportEvidence = {
  id: string;
  milestoneId: string;
  status: string;
  currentVersionId: string | null;
  createdAt: string;
  versions: PassportVersion[];
  attestations: PassportAttestation[];
};

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type PassportCorrection = {
  id: string;
  status: string;
  reason: string;
  createdAt: string;
  originalRecord: {
    eventId: string;
    eventType: string;
    referenceId: string | null;
    evidenceVersion: { id: string; evidenceId: string; versionNumber: number; sha256: string; createdAt: string } | null;
    blockchainProof: PassportProof | null;
  };
  correctedEvidence: {
    id: string;
    currentVersionId: string | null;
    versions: Array<{ id: string; versionNumber: number; sha256: string; createdAt: string }>;
  } | null;
  correctionProof: PassportProof | null;
  resolutions: Array<{
    id: string;
    status: string;
    resolution: string;
    resolvedById: string;
    resolvedByRole: string;
    correctedEvidenceVersion: { id: string; evidenceId: string; versionNumber: number; sha256: string; createdAt: string } | null;
    createdAt: string;
  }>;
};

export type PassportMilestone = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  policy: { id: string; name: string; requiredApprovals: number; allowedRoles: string[] } | null;
  createdAt: string;
  updatedAt: string;
  evidence: PassportEvidence[];
  corrections: PassportCorrection[];
};

export type PassportVariation = {
  id: string;
  variationReference: string;
  reason: string;
  status: string;
  createdAt: string;
  review: { reviewedById: string | null; reviewedByRole: string | null; reviewedAt: string } | null;
  originalState: JsonValue;
  proposedState: JsonValue;
  milestone: JsonValue;
  evidence: JsonValue;
  previousProof: PassportProof | null;
  variationProof: PassportProof | null;
  resolutions: Array<{
    id: string;
    status: string;
    decision: string;
    note: string | null;
    resolvedById: string;
    resolvedByRole: string;
    createdAt: string;
  }>;
};

export type ProjectPassport = {
  contractor: {
    id: string;
    legalName: string;
    crbRegistrationNumber: string | null;
    crbCategory: string | null;
    crbType: string | null;
    crbClass: string | null;
    crbStatus: string | null;
    crbLastVerifiedAt: string | null;
    crbSource: string | null;
  };
  project: {
    id: string;
    contractorId: string;
    name: string;
    description: string | null;
    nestTenderReference: string | null;
    nestContractReference: string | null;
    ocid: string | null;
    procuringEntity: string | null;
    contractStatus: string | null;
    contractStartDate: string | null;
    contractEndDate: string | null;
    createdAt: string;
    updatedAt: string;
  };
  milestones: PassportMilestone[];
  variations: PassportVariation[];
  blockchainProofs: PassportProof[];
};

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null) return null;
  return typeof value === "string" ? value : undefined;
}

function timestamp(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function nullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return timestamp(value) ?? undefined;
}

function parseArray<T>(value: unknown, parser: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const result = value.map(parser);
  return result.some((item) => item === null) ? null : result as T[];
}

function parseJson(value: unknown): JsonValue | null {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (Array.isArray(value)) {
    const items: JsonValue[] = [];
    for (const item of value) {
      const parsed = parseJson(item);
      if (parsed === null && item !== null) return null;
      items.push(parsed);
    }
    return items;
  }
  if (isPlainRecord(value)) {
    const result: Record<string, JsonValue> = {};
    for (const [key, item] of Object.entries(value)) {
      const parsed = parseJson(item);
      if (parsed === null && item !== null) return null;
      result[key] = parsed;
    }
    return result;
  }
  return null;
}

function parseProof(value: unknown, related = false): PassportProof | null | undefined {
  if (value === null) return null;
  if (!isPlainRecord(value)) return undefined;
  const id = requiredString(value.id);
  const eventType = requiredString(value.eventType);
  const referenceId = nullableString(value.referenceId);
  const txHash = nullableString(value.txHash);
  const blockNumber = value.blockNumber === null
    ? null
    : typeof value.blockNumber === "number" && Number.isSafeInteger(value.blockNumber) && value.blockNumber >= 0
      ? value.blockNumber
      : undefined;
  const confirmationState = value.confirmationState;
  const confirmed = value.confirmed;
  const createdAt = timestamp(value.createdAt);
  const evidenceHash = related ? undefined : nullableString(value.evidenceHash);
  if (
    !id || !eventType || referenceId === undefined || txHash === undefined || blockNumber === undefined ||
    (confirmationState !== "CONFIRMED" && confirmationState !== "PENDING") ||
    typeof confirmed !== "boolean" || !createdAt || (!related && evidenceHash === undefined) ||
    (related && "evidenceHash" in value && nullableString(value.evidenceHash) === undefined)
  ) return undefined;
  return {
    id,
    eventType,
    referenceId,
    ...("evidenceHash" in value && evidenceHash !== undefined ? { evidenceHash } : {}),
    txHash,
    blockNumber,
    confirmationState,
    confirmed,
    createdAt,
  };
}

function parseVersion(value: unknown): PassportVersion | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const versionNumber = value.versionNumber;
  const sha256 = requiredString(value.sha256);
  const createdAt = timestamp(value.createdAt);
  const verificationStatus = value.verificationStatus;
  const verifications = parseArray(value.verifications, parseVerification);
  const blockchainProof = parseProof(value.blockchainProof);
  if (
    !id || typeof versionNumber !== "number" || !Number.isSafeInteger(versionNumber) || versionNumber < 1 ||
    !sha256 || !createdAt ||
    !(verificationStatus === null || (typeof verificationStatus === "string" && isVerificationState(verificationStatus))) ||
    !verifications || blockchainProof === undefined
  ) return null;
  return { id, versionNumber, sha256, createdAt, verificationStatus, verifications, blockchainProof };
}

function parseVerification(value: unknown): PassportVerification | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const status = value.status;
  const source = requiredString(value.source);
  const createdAt = timestamp(value.createdAt);
  if (!id || typeof status !== "string" || !isVerificationState(status) || !source || !createdAt) return null;
  return { id, status, source, createdAt };
}

function parseAttestation(value: unknown): PassportAttestation | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const evidenceId = requiredString(value.evidenceId);
  const milestoneId = requiredString(value.milestoneId);
  const policyId = nullableString(value.policyId);
  const decision = requiredString(value.decision);
  const verifierRole = requiredString(value.verifierRole);
  const createdAt = timestamp(value.createdAt);
  const blockchainProof = parseProof(value.blockchainProof);
  if (!id || !evidenceId || !milestoneId || policyId === undefined || !decision || !verifierRole || !createdAt || blockchainProof === undefined) return null;
  return { id, evidenceId, milestoneId, policyId, decision, verifierRole, createdAt, blockchainProof };
}

function parseEvidence(value: unknown): PassportEvidence | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const milestoneId = requiredString(value.milestoneId);
  const status = requiredString(value.status);
  const currentVersionId = nullableString(value.currentVersionId);
  const createdAt = timestamp(value.createdAt);
  const versions = parseArray(value.versions, parseVersion);
  const attestations = parseArray(value.attestations, parseAttestation);
  if (!id || !milestoneId || !status || currentVersionId === undefined || !createdAt || !versions || !attestations) return null;
  return { id, milestoneId, status, currentVersionId, createdAt, versions, attestations };
}

function parseVersionSummary(value: unknown) {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const evidenceId = requiredString(value.evidenceId);
  const versionNumber = value.versionNumber;
  const sha256 = requiredString(value.sha256);
  const createdAt = timestamp(value.createdAt);
  if (!id || !evidenceId || typeof versionNumber !== "number" || !Number.isSafeInteger(versionNumber) || !sha256 || !createdAt) return null;
  return { id, evidenceId, versionNumber, sha256, createdAt };
}

function parseCorrection(value: unknown): PassportCorrection | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const status = requiredString(value.status);
  const reason = requiredString(value.reason);
  const createdAt = timestamp(value.createdAt);
  if (!id || !status || !reason || !createdAt || !isPlainRecord(value.originalRecord)) return null;
  const original = value.originalRecord;
  const eventId = requiredString(original.eventId);
  const eventType = requiredString(original.eventType);
  const referenceId = nullableString(original.referenceId);
  const evidenceVersion = original.evidenceVersion === null ? null : parseVersionSummary(original.evidenceVersion);
  const originalProof = parseProof(original.blockchainProof, true);
  let correctedEvidence: PassportCorrection["correctedEvidence"] = null;
  if (value.correctedEvidence !== null) {
    if (!isPlainRecord(value.correctedEvidence)) return null;
    const correctedId = requiredString(value.correctedEvidence.id);
    const currentVersionId = nullableString(value.correctedEvidence.currentVersionId);
    const versions = parseArray(value.correctedEvidence.versions, (item) => {
      if (!isPlainRecord(item)) return null;
      const summary = parseVersionSummary({ ...item, evidenceId: correctedId });
      return summary ? { id: summary.id, versionNumber: summary.versionNumber, sha256: summary.sha256, createdAt: summary.createdAt } : null;
    });
    if (!correctedId || currentVersionId === undefined || !versions) return null;
    correctedEvidence = { id: correctedId, currentVersionId, versions };
  }
  const correctionProof = parseProof(value.correctionProof, true);
  const resolutions = parseArray(value.resolutions, (item) => {
    if (!isPlainRecord(item)) return null;
    const resolutionId = requiredString(item.id);
    const resolutionStatus = requiredString(item.status);
    const resolution = requiredString(item.resolution);
    const resolvedById = requiredString(item.resolvedById);
    const resolvedByRole = requiredString(item.resolvedByRole);
    const correctedEvidenceVersion = item.correctedEvidenceVersion === null ? null : parseVersionSummary(item.correctedEvidenceVersion);
    const resolvedAt = timestamp(item.createdAt);
    if (!resolutionId || !resolutionStatus || !resolution || !resolvedById || !resolvedByRole || !resolvedAt || (item.correctedEvidenceVersion !== null && !correctedEvidenceVersion)) return null;
    return { id: resolutionId, status: resolutionStatus, resolution, resolvedById, resolvedByRole, correctedEvidenceVersion, createdAt: resolvedAt };
  });
  if (!eventId || !eventType || referenceId === undefined || (original.evidenceVersion !== null && !evidenceVersion) || originalProof === undefined || correctionProof === undefined || !resolutions) return null;
  return {
    id, status, reason, createdAt,
    originalRecord: { eventId, eventType, referenceId, evidenceVersion, blockchainProof: originalProof },
    correctedEvidence, correctionProof, resolutions,
  };
}

function parsePolicy(value: unknown): PassportMilestone["policy"] | null | undefined {
  if (value === null) return null;
  if (!isPlainRecord(value)) return undefined;
  const id = requiredString(value.id);
  const name = requiredString(value.name);
  const requiredApprovals = value.requiredApprovals;
  const allowedRoles = parseArray(value.allowedRoles, (role) => typeof role === "string" ? role : null);
  if (!id || !name || typeof requiredApprovals !== "number" || !Number.isSafeInteger(requiredApprovals) || !allowedRoles) return undefined;
  return { id, name, requiredApprovals, allowedRoles };
}

function parseMilestone(value: unknown): PassportMilestone | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const name = requiredString(value.name);
  const description = nullableString(value.description);
  const status = requiredString(value.status);
  const policy = parsePolicy(value.policy);
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  const evidence = parseArray(value.evidence, parseEvidence);
  const corrections = parseArray(value.corrections, parseCorrection);
  if (!id || !name || description === undefined || !status || policy === undefined || !createdAt || !updatedAt || !evidence || !corrections) return null;
  return { id, name, description, status, policy, createdAt, updatedAt, evidence, corrections };
}

function parseVariation(value: unknown): PassportVariation | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const variationReference = requiredString(value.variationReference);
  const reason = requiredString(value.reason);
  const status = requiredString(value.status);
  const createdAt = timestamp(value.createdAt);
  let review: PassportVariation["review"] = null;
  if (value.review !== null) {
    if (!isPlainRecord(value.review)) return null;
    const reviewedById = nullableString(value.review.reviewedById);
    const reviewedByRole = nullableString(value.review.reviewedByRole);
    const reviewedAt = timestamp(value.review.reviewedAt);
    if (reviewedById === undefined || reviewedByRole === undefined || !reviewedAt) return null;
    review = { reviewedById, reviewedByRole, reviewedAt };
  }
  const originalState = parseJson(value.originalState);
  const proposedState = parseJson(value.proposedState);
  const milestone = parseJson(value.milestone);
  const evidence = parseJson(value.evidence);
  const previousProof = parseProof(value.previousProof, true);
  const variationProof = parseProof(value.variationProof, true);
  const resolutions = parseArray(value.resolutions, (item) => {
    if (!isPlainRecord(item)) return null;
    const resolutionId = requiredString(item.id);
    const resolutionStatus = requiredString(item.status);
    const decision = requiredString(item.decision);
    const note = nullableString(item.note);
    const resolvedById = requiredString(item.resolvedById);
    const resolvedByRole = requiredString(item.resolvedByRole);
    const resolvedAt = timestamp(item.createdAt);
    if (!resolutionId || !resolutionStatus || !decision || note === undefined || !resolvedById || !resolvedByRole || !resolvedAt) return null;
    return { id: resolutionId, status: resolutionStatus, decision, note, resolvedById, resolvedByRole, createdAt: resolvedAt };
  });
  if (!id || !variationReference || !reason || !status || !createdAt || originalState === null || proposedState === null || milestone === null || evidence === null || previousProof === undefined || variationProof === undefined || !resolutions) return null;
  return { id, variationReference, reason, status, createdAt, review, originalState, proposedState, milestone, evidence, previousProof, variationProof, resolutions };
}

function parseContractor(value: unknown): ProjectPassport["contractor"] | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const legalName = requiredString(value.legalName);
  const crbRegistrationNumber = nullableString(value.crbRegistrationNumber);
  const crbCategory = nullableString(value.crbCategory);
  const crbType = nullableString(value.crbType);
  const crbClass = nullableString(value.crbClass);
  const crbStatus = nullableString(value.crbStatus);
  const crbLastVerifiedAt = nullableTimestamp(value.crbLastVerifiedAt);
  const crbSource = nullableString(value.crbSource);
  if (!id || !legalName || crbRegistrationNumber === undefined || crbCategory === undefined || crbType === undefined || crbClass === undefined || crbStatus === undefined || crbLastVerifiedAt === undefined || crbSource === undefined) return null;
  return { id, legalName, crbRegistrationNumber, crbCategory, crbType, crbClass, crbStatus, crbLastVerifiedAt, crbSource };
}

function parseProject(value: unknown): ProjectPassport["project"] | null {
  if (!isPlainRecord(value)) return null;
  const id = requiredString(value.id);
  const contractorId = requiredString(value.contractorId);
  const name = requiredString(value.name);
  const description = nullableString(value.description);
  const nestTenderReference = nullableString(value.nestTenderReference);
  const nestContractReference = nullableString(value.nestContractReference);
  const ocid = nullableString(value.ocid);
  const procuringEntity = nullableString(value.procuringEntity);
  const contractStatus = nullableString(value.contractStatus);
  const contractStartDate = nullableTimestamp(value.contractStartDate);
  const contractEndDate = nullableTimestamp(value.contractEndDate);
  const createdAt = timestamp(value.createdAt);
  const updatedAt = timestamp(value.updatedAt);
  if (!id || !contractorId || !name || description === undefined || nestTenderReference === undefined || nestContractReference === undefined || ocid === undefined || procuringEntity === undefined || contractStatus === undefined || contractStartDate === undefined || contractEndDate === undefined || !createdAt || !updatedAt) return null;
  return { id, contractorId, name, description, nestTenderReference, nestContractReference, ocid, procuringEntity, contractStatus, contractStartDate, contractEndDate, createdAt, updatedAt };
}

function parseProofList(value: unknown): PassportProof[] | null {
  return parseArray(value, (item) => {
    const parsed = parseProof(item);
    return parsed === undefined || parsed === null ? null : parsed;
  });
}

export function isVerificationState(value: string): value is VerificationState {
  return (VERIFICATION_STATES as readonly string[]).includes(value);
}

export function parseProjectPassport(value: unknown): ProjectPassport | null {
  if (!isPlainRecord(value)) return null;
  const contractor = parseContractor(value.contractor);
  const project = parseProject(value.project);
  const milestones = parseArray(value.milestones, parseMilestone);
  const variations = parseArray(value.variations, parseVariation);
  const blockchainProofs = parseProofList(value.blockchainProofs);
  if (!contractor || !project || !milestones || !variations || !blockchainProofs) return null;
  return { contractor, project, milestones, variations, blockchainProofs };
}

export function parseProjectPassports(payload: unknown): ProjectPassport[] {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    throw new Error("The passport list response is not in a known format.");
  }
  const passports = parseArray(payload.data.passports, parseProjectPassport);
  if (!passports) throw new Error("The passport list response is not in a known format.");
  return passports;
}

export function parseSingleProjectPassport(payload: unknown): ProjectPassport {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    throw new Error("The passport detail response is not in a known format.");
  }
  const passport = parseProjectPassport(payload.data.passport);
  if (!passport) throw new Error("The passport detail response is not in a known format.");
  return passport;
}