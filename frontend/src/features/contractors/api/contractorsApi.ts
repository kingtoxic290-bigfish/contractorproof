import { apiRequest } from "../../../services/api/client";
import { unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import {
  parseContractorPassport,
  parsePublicContractor,
  type ContractorPassport,
  type PublicContractor,
} from "../types";

function parseContractorList(payload: unknown): PublicContractor[] {
  const records = unwrapNamedList(payload, "contractors");
  if (!records) {
    throw new Error("The contractor list response is not in a known format.");
  }

  const contractors = records
    .map(parsePublicContractor)
    .filter((record): record is PublicContractor => record !== null);
  if (contractors.length !== records.length) {
    throw new Error("The contractor list response is not in a known format.");
  }
  return contractors;
}

export async function listContractors(): Promise<PublicContractor[]> {
  return parseContractorList(await apiRequest<unknown>("/contractors"));
}

/**
 * Contractor discovery by CRB Registration Number.
 *
 * The backend matches the number against ContractorProof contractor records.
 * This is not a call to CRB and produces no CRB-sourced verdict.
 */
export async function searchContractorsByCrbRegistrationNumber(
  registrationNumber: string,
): Promise<PublicContractor[]> {
  const query = new URLSearchParams({
    crbRegistrationNumber: registrationNumber.trim(),
  });
  return parseContractorList(await apiRequest<unknown>(`/contractors?${query.toString()}`));
}

export async function getContractor(contractorId: string): Promise<PublicContractor> {
  const payload = await apiRequest<unknown>(`/contractors/${contractorId}`);
  const record = unwrapNamedRecord(payload, "contractor");
  const contractor = record ? parsePublicContractor(record) : null;
  if (!contractor) {
    throw new Error("The contractor response is not in a known format.");
  }
  return contractor;
}

function unwrapPassport(payload: unknown): ContractorPassport {
  const record = unwrapNamedRecord(payload, "contractorPassport");
  const passport = record ? parseContractorPassport(record) : null;
  if (!passport) {
    throw new Error("The contractor passport response is not in a known format.");
  }
  return passport;
}

export async function getContractorPassport(
  contractorId: string,
): Promise<ContractorPassport> {
  return unwrapPassport(
    await apiRequest<unknown>(`/contractors/${encodeURIComponent(contractorId)}/passport`),
  );
}

/** Own passport for a signed-in CONTRACTOR. The id comes from the session. */
export async function getOwnContractorPassport(): Promise<ContractorPassport> {
  return unwrapPassport(await apiRequest<unknown>("/contractors/me/passport"));
}