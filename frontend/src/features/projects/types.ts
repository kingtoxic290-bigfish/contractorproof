import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

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

export function parsePublicProject(value: unknown): PublicProject | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const clientId = asNullableString(value.clientId);
  const clientName = asNullableString(value.clientName);
  const contractorId = asRequiredString(value.contractorId);
  const contractorName = asRequiredString(value.contractorName);
  const name = asRequiredString(value.name);
  const nestSource = asRequiredString(value.nestSource);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  if (!id || !contractorId || !contractorName || !name || !nestSource || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    clientId,
    clientName,
    contractorId,
    contractorName,
    name,
    description: asNullableString(value.description),
    nestTenderReference: asNullableString(value.nestTenderReference),
    nestContractReference: asNullableString(value.nestContractReference),
    ocid: asNullableString(value.ocid),
    procuringEntity: asNullableString(value.procuringEntity),
    contractStatus: asNullableString(value.contractStatus),
    contractStartDate: asNullableString(value.contractStartDate),
    contractEndDate: asNullableString(value.contractEndDate),
    nestSource,
    createdAt,
    updatedAt,
  };
}

export type NestLookupResponse = {
  notice: string;
  source: "SYNTHETIC_DEMO";
  found: boolean;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  procuringEntity: string | null;
  contractStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
};
