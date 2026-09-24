import { apiRequest } from "../../../services/api/client";
import { unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import { parsePublicContractor, type PublicContractor } from "../types";

export async function listContractors(): Promise<PublicContractor[]> {
  const payload = await apiRequest<unknown>("/contractors");
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

export async function getContractor(contractorId: string): Promise<PublicContractor> {
  const payload = await apiRequest<unknown>(`/contractors/${contractorId}`);
  const record = unwrapNamedRecord(payload, "contractor");
  const contractor = record ? parsePublicContractor(record) : null;
  if (!contractor) {
    throw new Error("The contractor response is not in a known format.");
  }
  return contractor;
}
