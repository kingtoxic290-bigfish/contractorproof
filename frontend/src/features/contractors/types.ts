import type { PublicUser } from "../../types/auth";
import { isRole } from "../../types/roles";
import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export type { PublicUser };

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
  crbSource: string | null;
  createdAt: string;
  updatedAt: string;
  user: PublicUser;
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
  const userId = asRequiredString(value.userId);
  const legalName = asRequiredString(value.legalName);
  // The API returns null until a CRB check has actually been performed against
  // a source, so this field must stay nullable. Treating it as required caused
  // a single such record to reject the whole contractor collection.
  const crbSource = asNullableString(value.crbSource);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  const user = parsePublicUser(value.user);
  if (!id || !userId || !legalName || !createdAt || !updatedAt || !user) {
    return null;
  }

  return {
    id,
    userId,
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
    user,
  };
}

export type CrbLookupResponse = {
  notice: string;
  source: "SYNTHETIC_DEMO";
  found: boolean;
  crbRegistrationNumber: string;
  crbCategory: string | null;
  crbType: string | null;
  crbClass: string | null;
  crbStatus: string | null;
  crbLastVerifiedAt: string | null;
};
