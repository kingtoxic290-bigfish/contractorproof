export const VERIFICATION_STATES = ["MATCH", "MISMATCH", "PENDING", "UNAVAILABLE"] as const;
export type VerificationState = (typeof VERIFICATION_STATES)[number];

export type DashboardVerification = {
  id: string;
  status: VerificationState;
  source: string;
  createdAt: string;
};

export type DashboardProof = {
  id: string;
  eventType: string;
  referenceId: string | null;
  txHash: string | null;
  blockNumber: number | null;
  confirmationState: "CONFIRMED" | "PENDING";
  confirmed: boolean;
  createdAt: string;
};

export type DashboardAttestation = {
  id: string;
  decision: string;
  createdAt: string;
};

export type DashboardVersion = {
  id: string;
  versionNumber: number;
  sha256: string;
  createdAt: string;
  verificationStatus: VerificationState | null;
  verifications: DashboardVerification[];
};

export type DashboardEvidence = {
  id: string;
  milestoneId: string;
  createdAt: string;
  versions: DashboardVersion[];
  attestations: DashboardAttestation[];
};

export type DashboardMilestone = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  evidence: DashboardEvidence[];
};

export type DashboardProjectPassport = {
  contractor: {
    id: string;
    legalName: string;
  };
  project: {
    id: string;
    contractorId: string;
    name: string;
    contractStatus: string | null;
    createdAt: string;
  };
  milestones: DashboardMilestone[];
  blockchainProofs: DashboardProof[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : undefined;
}

function parseList<T>(value: unknown, parse: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null;
  const entries = value.map(parse);
  return entries.every((entry): entry is T => entry !== null) ? entries : null;
}

function parseVerification(value: unknown): DashboardVerification | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const status = requiredString(value.status);
  const source = requiredString(value.source);
  const createdAt = requiredString(value.createdAt);
  if (
    !id ||
    !status ||
    !VERIFICATION_STATES.includes(status as VerificationState) ||
    !source ||
    !createdAt
  ) {
    return null;
  }
  return { id, status: status as VerificationState, source, createdAt };
}

function parseVersion(value: unknown): DashboardVersion | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const versionNumber = value.versionNumber;
  const sha256 = requiredString(value.sha256);
  const createdAt = requiredString(value.createdAt);
  const verificationStatus = nullableString(value.verificationStatus);
  const verifications = parseList(value.verifications, parseVerification);
  if (
    !id ||
    typeof versionNumber !== "number" ||
    !Number.isFinite(versionNumber) ||
    !sha256 ||
    !createdAt ||
    verificationStatus === undefined ||
    (verificationStatus !== null && !VERIFICATION_STATES.includes(verificationStatus as VerificationState)) ||
    !verifications
  ) {
    return null;
  }
  return {
    id,
    versionNumber,
    sha256,
    createdAt,
    verificationStatus: verificationStatus as VerificationState | null,
    verifications,
  };
}

function parseAttestation(value: unknown): DashboardAttestation | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const decision = requiredString(value.decision);
  const createdAt = requiredString(value.createdAt);
  return id && decision && createdAt ? { id, decision, createdAt } : null;
}

function parseEvidence(value: unknown): DashboardEvidence | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const milestoneId = requiredString(value.milestoneId);
  const createdAt = requiredString(value.createdAt);
  const versions = parseList(value.versions, parseVersion);
  const attestations = parseList(value.attestations, parseAttestation);
  if (!id || !milestoneId || !createdAt || !versions || !attestations) return null;
  return { id, milestoneId, createdAt, versions, attestations };
}

function parseMilestone(value: unknown): DashboardMilestone | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const name = requiredString(value.name);
  const status = requiredString(value.status);
  const createdAt = requiredString(value.createdAt);
  const evidence = parseList(value.evidence, parseEvidence);
  if (!id || !name || !status || !createdAt || !evidence) return null;
  return { id, name, status, createdAt, evidence };
}

function parseProof(value: unknown): DashboardProof | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value.id);
  const eventType = requiredString(value.eventType);
  const referenceId = nullableString(value.referenceId);
  const txHash = nullableString(value.txHash);
  const blockNumber = value.blockNumber;
  const confirmationState = requiredString(value.confirmationState);
  const createdAt = requiredString(value.createdAt);
  if (
    !id ||
    !eventType ||
    referenceId === undefined ||
    txHash === undefined ||
    (blockNumber !== null && (typeof blockNumber !== "number" || !Number.isFinite(blockNumber))) ||
    (confirmationState !== "CONFIRMED" && confirmationState !== "PENDING") ||
    typeof value.confirmed !== "boolean" ||
    value.confirmed !== (confirmationState === "CONFIRMED") ||
    (value.confirmed && (!txHash || typeof blockNumber !== "number" || blockNumber <= 0)) ||
    !createdAt
  ) {
    return null;
  }
  return {
    id,
    eventType,
    referenceId,
    txHash,
    blockNumber: blockNumber as number | null,
    confirmationState,
    confirmed: value.confirmed,
    createdAt,
  };
}

function parseProjectPassport(value: unknown): DashboardProjectPassport | null {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.contractor)) return null;
  const projectId = requiredString(value.project.id);
  const contractorId = requiredString(value.project.contractorId);
  const projectName = requiredString(value.project.name);
  const projectCreatedAt = requiredString(value.project.createdAt);
  const legalName = requiredString(value.contractor.legalName);
  const contractorRecordId = requiredString(value.contractor.id);
  const contractStatus = nullableString(value.project.contractStatus);
  const milestones = parseList(value.milestones, parseMilestone);
  const blockchainProofs = parseList(value.blockchainProofs, parseProof);
  if (
    !projectId ||
    !contractorId ||
    !projectName ||
    !projectCreatedAt ||
    !legalName ||
    !contractorRecordId ||
    contractStatus === undefined ||
    !milestones ||
    !blockchainProofs
  ) {
    return null;
  }
  return {
    contractor: { id: contractorRecordId, legalName },
    project: {
      id: projectId,
      contractorId,
      name: projectName,
      contractStatus,
      createdAt: projectCreatedAt,
    },
    milestones,
    blockchainProofs,
  };
}

export function parseDashboardPassports(payload: unknown): DashboardProjectPassport[] {
  if (!isRecord(payload) || !isRecord(payload.data)) {
    throw new Error("The dashboard response is not in a known format.");
  }
  const passports = parseList(payload.data.passports, parseProjectPassport);
  if (!passports) {
    throw new Error("The dashboard response is not in a known format.");
  }
  return passports;
}