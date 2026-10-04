import type { PublicUser } from "../../types/auth";
import { isRole } from "../../types/roles";
import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export type { PublicUser };

export type PublicContractor = {
  id: string;
  legalName: string;
  crbRegistrationNumber: string | null;
  crbCategory: string | null;
  crbType: string | null;
  crbClass: string | null;
  crbStatus: string | null;
  crbLastVerifiedAt: string | null;
  crbSource: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * The API is permitted to omit the linked account. Discovery must keep
   * working whether or not it is present, so neither field is required.
   */
  userId?: string;
  user?: PublicUser;
};

export function parsePublicUser(value: unknown): PublicUser | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const email = asRequiredString(value.email);
  const fullName = asRequiredString(value.fullName);
  const role = asRequiredString(value.role);
  if (!id || !email || !fullName || !role || !isRole(role)) {
    return null;
  }

  return { id, email, fullName, role };
}

export function parsePublicContractor(value: unknown): PublicContractor | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const legalName = asRequiredString(value.legalName);
  // The API returns null until a CRB check has actually been performed against
  // a source, so this field must stay nullable. Treating it as required caused
  // a single such record to reject the whole contractor collection.
  const crbSource = asNullableString(value.crbSource);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  if (!id || !legalName || !createdAt || !updatedAt) {
    return null;
  }

  // Optional in the API: a contractor record may be returned without its linked
  // account, and discovery must not depend on that nested object.
  const userId = asNullableString(value.userId) ?? undefined;
  const user = "user" in value && value.user !== null && value.user !== undefined
    ? parsePublicUser(value.user) ?? undefined
    : undefined;

  return {
    id,
    legalName,
    crbRegistrationNumber: asNullableString(value.crbRegistrationNumber),
    crbCategory: asNullableString(value.crbCategory),
    crbType: asNullableString(value.crbType),
    crbClass: asNullableString(value.crbClass),
    crbStatus: asNullableString(value.crbStatus),
    crbLastVerifiedAt: asNullableString(value.crbLastVerifiedAt),
    crbSource,
    createdAt,
    updatedAt,
    ...(userId ? { userId } : {}),
    ...(user ? { user } : {}),
  };
}

export type Counters = Record<string, number>;

export type PassportCounts = {
  total: number;
  byStatus: Counters;
};

export type PassportAttestationCounts = Counters;

export type ContractorPassportCrbCheck = {
  id: string;
  registrationReference: string;
  status: string;
  source: string;
  registrationNumber: string | null;
  registeredName: string | null;
  category: string | null;
  registrationClass: string | null;
  registrationDate: string | null;
  expiryDate: string | null;
  externalReference: string | null;
  checkedAt: string;
  canonicalDigest: string;
  failureCode: string | null;
  requestedById: string | null;
};

export type ContractorPassportMilestone = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  evidence: PassportCounts & { attestations: PassportAttestationCounts; verification: Counters };
  corrections: PassportCounts;
  disputes: PassportCounts;
};

export type ContractorPassportProject = {
  id: string;
  name: string;
  description: string | null;
  clientId: string | null;
  clientName: string | null;
  clientVisible: boolean;
  contractStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  procuringEntity: string | null;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  createdAt: string;
  milestones: ContractorPassportMilestone[];
  milestoneStatus: {
    total: number;
    byStatus: Counters;
    allVerified: boolean;
    withUnverified: boolean;
  };
  evidence: PassportCounts;
  attestations: PassportAttestationCounts;
  verification: Counters;
  disputes: PassportCounts;
  corrections: PassportCounts;
  proof: { total: number; confirmed: number; pending: number };
};

export type ContractorPassport = {
  scope: {
    viewerRole: string;
    isOwnPassport: boolean;
    contractorProjectCount: number;
    withheldProjectDetailCount: number;
    milestoneCompletionBasis: string;
    verifiedHistoryBasis?: string;
    containsRatings: boolean;
  };
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
    createdAt: string;
    updatedAt: string;
    account: {
      userId: string;
      fullName: string;
      role: string;
      registeredAt: string;
    };
  };
  crbRegistrations: {
    checkCount: number;
    latest: ContractorPassportCrbCheck | null;
    history: ContractorPassportCrbCheck[];
  };
  totals: {
    projects: number;
    projectsWithAllMilestonesVerified: number;
    projectsWithUnverifiedMilestones: number;
    projectsWithoutMilestones: number;
    verifiedHistory?: number;
    activeProjects?: number;
    milestones: Counters;
    evidence: Counters;
    attestations: PassportAttestationCounts;
    verification: Counters;
    disputes: Counters;
    corrections: Counters;
    blockchainProofs: { total: number; confirmed: number; pending: number };
  };
  projects: ContractorPassportProject[];
  /**
   * The same project objects partitioned by whether every milestone they own is
   * VERIFIED. Each project appears in exactly one of the two lists. Optional so
   * that a server which does not send the split still parses; callers should
   * fall back to `projects` when they are absent.
   */
  verifiedHistory?: ContractorPassportProject[];
  activeProjects?: ContractorPassportProject[];
};

function count(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function booleanField(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function counters(value: unknown): Counters | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const result: Counters = {};
  for (const [key, entry] of Object.entries(value)) {
    const entryCount = count(entry);
    if (entryCount === null) {
      return null;
    }
    result[key] = entryCount;
  }
  return result;
}

function passCounts(value: unknown): PassportCounts | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const total = count(value.total);
  const byStatus = counters(value.byStatus);
  return total === null || byStatus === null ? null : { total, byStatus };
}

function proofCounts(value: unknown): { total: number; confirmed: number; pending: number } | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const total = count(value.total);
  const confirmed = count(value.confirmed);
  const pending = count(value.pending);
  return total === null || confirmed === null || pending === null
    ? null
    : { total, confirmed, pending };
}

function parseCrbCheck(value: unknown): ContractorPassportCrbCheck | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const id = asRequiredString(value.id);
  const registrationReference = asRequiredString(value.registrationReference);
  const status = asRequiredString(value.status);
  const source = asRequiredString(value.source);
  const registrationNumber = asNullableString(value.registrationNumber);
  const registeredName = asNullableString(value.registeredName);
  const category = asNullableString(value.category);
  const registrationClass = asNullableString(value.registrationClass);
  const registrationDate = asNullableString(value.registrationDate);
  const expiryDate = asNullableString(value.expiryDate);
  const externalReference = asNullableString(value.externalReference);
  const checkedAt = asRequiredString(value.checkedAt);
  const canonicalDigest = asRequiredString(value.canonicalDigest);
  const failureCode = asNullableString(value.failureCode);
  const requestedById = asNullableString(value.requestedById);
  if (
    !id ||
    !registrationReference ||
    !status ||
    !source ||
    !checkedAt ||
    !canonicalDigest ||
    [registrationNumber, registeredName, category, registrationClass, registrationDate, expiryDate,
      externalReference, failureCode, requestedById].some((field) => field === undefined)
  ) {
    return null;
  }
  return {
    id,
    registrationReference,
    status,
    source,
    registrationNumber,
    registeredName,
    category,
    registrationClass,
    registrationDate,
    expiryDate,
    externalReference,
    checkedAt,
    canonicalDigest,
    failureCode,
    requestedById,
  };
}

function parseList<T>(value: unknown, parser: (item: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const parsed = value.map(parser);
  return parsed.some((item) => item === null) ? null : (parsed as T[]);
}

function parsePassportMilestone(value: unknown): ContractorPassportMilestone | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const id = asRequiredString(value.id);
  const name = asRequiredString(value.name);
  const status = asRequiredString(value.status);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  const evidenceBlock = isPlainRecord(value.evidence) ? value.evidence : null;
  const evidenceTotal = count(evidenceBlock?.total);
  const evidenceByStatus = counters(evidenceBlock?.byStatus);
  const evidenceAttestations = counters(evidenceBlock?.attestations);
  const evidenceVerification = counters(evidenceBlock?.verification);
  const corrections = passCounts(value.corrections);
  const disputes = passCounts(value.disputes);
  if (
    !id ||
    !name ||
    !status ||
    !createdAt ||
    !updatedAt ||
    evidenceTotal === null ||
    evidenceByStatus === null ||
    evidenceAttestations === null ||
    evidenceVerification === null ||
    !corrections ||
    !disputes
  ) {
    return null;
  }
  return {
    id,
    name,
    status,
    createdAt,
    updatedAt,
    evidence: {
      total: evidenceTotal,
      byStatus: evidenceByStatus,
      attestations: evidenceAttestations,
      verification: evidenceVerification,
    },
    corrections,
    disputes,
  };
}

function parsePassportProject(value: unknown): ContractorPassportProject | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const id = asRequiredString(value.id);
  const name = asRequiredString(value.name);
  const description = asNullableString(value.description);
  const clientId = asNullableString(value.clientId);
  const clientName = asNullableString(value.clientName);
  const clientVisible = booleanField(value.clientVisible);
  const contractStatus = asNullableString(value.contractStatus);
  const contractStartDate = asNullableString(value.contractStartDate);
  const contractEndDate = asNullableString(value.contractEndDate);
  const procuringEntity = asNullableString(value.procuringEntity);
  const nestTenderReference = asNullableString(value.nestTenderReference);
  const nestContractReference = asNullableString(value.nestContractReference);
  const ocid = asNullableString(value.ocid);
  const createdAt = asRequiredString(value.createdAt);
  const milestones = parseList(value.milestones, parsePassportMilestone);
  const milestoneBlock = isPlainRecord(value.milestoneStatus) ? value.milestoneStatus : null;
  const milestoneTotal = count(milestoneBlock?.total);
  const milestoneByStatus = counters(milestoneBlock?.byStatus);
  const allVerified = booleanField(milestoneBlock?.allVerified);
  const withUnverified = booleanField(milestoneBlock?.withUnverified);
  const evidence = passCounts(value.evidence);
  const attestations = counters(value.attestations);
  const verification = counters(value.verification);
  const disputes = passCounts(value.disputes);
  const corrections = passCounts(value.corrections);
  const proof = proofCounts(value.proof);
  if (
    !id ||
    !name ||
    !createdAt ||
    clientVisible === null ||
    description === undefined ||
    clientId === undefined ||
    clientName === undefined ||
    contractStatus === undefined ||
    contractStartDate === undefined ||
    contractEndDate === undefined ||
    procuringEntity === undefined ||
    nestTenderReference === undefined ||
    nestContractReference === undefined ||
    ocid === undefined ||
    !milestones ||
    milestoneTotal === null ||
    milestoneByStatus === null ||
    allVerified === null ||
    withUnverified === null ||
    !evidence ||
    !attestations ||
    !verification ||
    !disputes ||
    !corrections ||
    !proof
  ) {
    return null;
  }
  return {
    id,
    name,
    description,
    clientId,
    clientName,
    clientVisible,
    contractStatus,
    contractStartDate,
    contractEndDate,
    procuringEntity,
    nestTenderReference,
    nestContractReference,
    ocid,
    createdAt,
    milestones,
    milestoneStatus: { total: milestoneTotal, byStatus: milestoneByStatus, allVerified, withUnverified },
    evidence,
    attestations,
    verification,
    disputes,
    corrections,
    proof,
  };
}

/**
 * Factual-only parse. A rating, score or recommendation key has no place in
 * this payload, so a response that adds one is rejected rather than displayed.
 */
export function parseContractorPassport(value: unknown): ContractorPassport | null {
  if (!isPlainRecord(value)) {
    return null;
  }
  const scopeBlock = isPlainRecord(value.scope) ? value.scope : null;
  const viewerRole = asRequiredString(scopeBlock?.viewerRole);
  const isOwnPassport = booleanField(scopeBlock?.isOwnPassport);
  const contractorProjectCount = count(scopeBlock?.contractorProjectCount);
  const withheldProjectDetailCount = count(scopeBlock?.withheldProjectDetailCount);
  const milestoneCompletionBasis = asRequiredString(scopeBlock?.milestoneCompletionBasis);
  const containsRatings = booleanField(scopeBlock?.containsRatings);
  if (
    !viewerRole ||
    isOwnPassport === null ||
    contractorProjectCount === null ||
    withheldProjectDetailCount === null ||
    !milestoneCompletionBasis ||
    containsRatings === null
  ) {
    return null;
  }

  const contractorBlock = isPlainRecord(value.contractor) ? value.contractor : null;
  const contractorId = asRequiredString(contractorBlock?.id);
  const legalName = asRequiredString(contractorBlock?.legalName);
  const crbRegistrationNumber = asNullableString(contractorBlock?.crbRegistrationNumber);
  const crbCategory = asNullableString(contractorBlock?.crbCategory);
  const crbType = asNullableString(contractorBlock?.crbType);
  const crbClass = asNullableString(contractorBlock?.crbClass);
  const crbStatus = asNullableString(contractorBlock?.crbStatus);
  const crbLastVerifiedAt = asNullableString(contractorBlock?.crbLastVerifiedAt);
  const crbSource = asNullableString(contractorBlock?.crbSource);
  const createdAt = asRequiredString(contractorBlock?.createdAt);
  const updatedAt = asRequiredString(contractorBlock?.updatedAt);
  // The API is permitted to omit the linked account, so this block must never
  // decide whether an otherwise valid passport is accepted. Treating it as
  // required rejected every real response that did not include it.
  const accountBlock = isPlainRecord(contractorBlock?.account) ? contractorBlock.account : null;
  const accountUserId = asRequiredString(accountBlock?.userId) ?? "";
  const accountFullName = asRequiredString(accountBlock?.fullName) ?? "";
  const accountRole = asRequiredString(accountBlock?.role) ?? "";
  const accountRegisteredAt = asRequiredString(accountBlock?.registeredAt) ?? "";
  if (
    !contractorId ||
    !legalName ||
    !createdAt ||
    !updatedAt ||
    [crbRegistrationNumber, crbCategory, crbType, crbClass, crbStatus, crbLastVerifiedAt, crbSource].some(
      (field) => field === undefined,
    )
  ) {
    return null;
  }

  const crbBlock = isPlainRecord(value.crbRegistrations) ? value.crbRegistrations : null;
  const checkCount = count(crbBlock?.checkCount);
  const latestRaw = crbBlock?.latest ?? null;
  const latest = latestRaw === null ? null : parseCrbCheck(latestRaw);
  const history = parseList(crbBlock?.history, parseCrbCheck);
  if (checkCount === null || latestRaw !== null && latest === null || !history) {
    return null;
  }

  const totalsBlock = isPlainRecord(value.totals) ? value.totals : null;
  const totalsProjects = count(totalsBlock?.projects);
  const projectsWithAllMilestonesVerified = count(totalsBlock?.projectsWithAllMilestonesVerified);
  const projectsWithUnverifiedMilestones = count(totalsBlock?.projectsWithUnverifiedMilestones);
  const projectsWithoutMilestones = count(totalsBlock?.projectsWithoutMilestones);
  const milestones = counters(totalsBlock?.milestones);
  const evidence = counters(totalsBlock?.evidence);
  const attestations = counters(totalsBlock?.attestations);
  const verification = counters(totalsBlock?.verification);
  const disputes = counters(totalsBlock?.disputes);
  const corrections = counters(totalsBlock?.corrections);
  const blockchainProofs = proofCounts(totalsBlock?.blockchainProofs);
  if (
    totalsProjects === null ||
    projectsWithAllMilestonesVerified === null ||
    projectsWithUnverifiedMilestones === null ||
    projectsWithoutMilestones === null ||
    !milestones ||
    !evidence ||
    !attestations ||
    !verification ||
    !disputes ||
    !corrections ||
    !blockchainProofs
  ) {
    return null;
  }

  const projects = parseList(value.projects, parsePassportProject);
  if (!projects) {
    return null;
  }

  // The verified/active split is additive: a response that omits it is still
  // valid, so neither list takes part in the guard above. A list that IS sent
  // but cannot be read is a malformed response, not an absent one, and is
  // rejected rather than quietly dropped.
  let verifiedHistory: ContractorPassportProject[] | undefined;
  if ("verifiedHistory" in value) {
    const parsed = parseList(value.verifiedHistory, parsePassportProject);
    if (!parsed) {
      return null;
    }
    verifiedHistory = parsed;
  }
  let activeProjects: ContractorPassportProject[] | undefined;
  if ("activeProjects" in value) {
    const parsed = parseList(value.activeProjects, parsePassportProject);
    if (!parsed) {
      return null;
    }
    activeProjects = parsed;
  }
  const verifiedHistoryTotal = count(totalsBlock?.verifiedHistory) ?? undefined;
  const activeProjectsTotal = count(totalsBlock?.activeProjects) ?? undefined;
  const verifiedHistoryBasis = asNullableString(scopeBlock?.verifiedHistoryBasis) ?? undefined;

  return {
    scope: {
      viewerRole,
      isOwnPassport,
      contractorProjectCount,
      withheldProjectDetailCount,
      milestoneCompletionBasis,
      ...(verifiedHistoryBasis !== undefined ? { verifiedHistoryBasis } : {}),
      containsRatings,
    },
    contractor: {
      id: contractorId,
      legalName,
      crbRegistrationNumber,
      crbCategory,
      crbType,
      crbClass,
      crbStatus,
      crbLastVerifiedAt,
      crbSource,
      createdAt,
      updatedAt,
      account: {
        userId: accountUserId,
        fullName: accountFullName,
        role: accountRole,
        registeredAt: accountRegisteredAt,
      },
    },
    crbRegistrations: { checkCount, latest, history },
    totals: {
      projects: totalsProjects,
      projectsWithAllMilestonesVerified,
      projectsWithUnverifiedMilestones,
      projectsWithoutMilestones,
      ...(verifiedHistoryTotal !== undefined ? { verifiedHistory: verifiedHistoryTotal } : {}),
      ...(activeProjectsTotal !== undefined ? { activeProjects: activeProjectsTotal } : {}),
      milestones,
      evidence,
      attestations,
      verification,
      disputes,
      corrections,
      blockchainProofs,
    },
    projects,
    ...(verifiedHistory !== undefined ? { verifiedHistory } : {}),
    ...(activeProjects !== undefined ? { activeProjects } : {}),
  };
}
