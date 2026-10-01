import type { MilestoneStatus, Role } from "@prisma/client";

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

export type PublicContractor = {
  id: string;
  userId: string;
  legalName: string;
  crbRegistrationNumber: string | null;
  crbCategory: string | null;
  crbType: string | null;
  crbClass: string | null;
  crbStatus: string | null;
  crbLastVerifiedAt: string | null;
  /** Null until an actual CRB check has been performed against a source. */
  crbSource: string | null;
  createdAt: string;
  updatedAt: string;
  user: PublicUser;
};

export type PublicProject = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  contractorId: string;
  contractorName: string;
  name: string;
  description: string | null;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  procuringEntity: string | null;
  contractStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  nestSource: string;
  createdAt: string;
  updatedAt: string;
};

export type PublicMilestone = {
  id: string;
  projectId: string;
  policyId: string | null;
  name: string;
  description: string | null;
  status: MilestoneStatus;
  createdAt: string;
  updatedAt: string;
};

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
};

export const PUBLIC_REGISTER_ROLES = [
  "CONTRACTOR",
  "CLIENT",
] as const satisfies readonly Role[];

export const PRIVILEGED_ROLES = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
  "CONSULTANT_ENGINEER",
] as const satisfies readonly Role[];

export const ATTEST_ROLES = [
  "CONSULTANT_ENGINEER",
  "CLIENT",
  "PROCUREMENT_OFFICER",
  "AUDITOR",
  "ADMIN",
] as const satisfies readonly Role[];

export type PublicRegisterRole = (typeof PUBLIC_REGISTER_ROLES)[number];
