import { asRequiredString, isPlainRecord } from "../shared/query";

export type PublicProject = {
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
  nestSource: string;
  createdAt: string;
  updatedAt: string;
};

function nullableString(value: unknown): string | null | undefined {
  if (value === null || value === undefined) return null;
  return typeof value === "string" ? value : undefined;
}

export function parsePublicProject(value: unknown): PublicProject | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const contractorId = asRequiredString(value.contractorId);
  const name = asRequiredString(value.name);
  const nestSource = asRequiredString(value.nestSource);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  const description = nullableString(value.description);
  const nestTenderReference = nullableString(value.nestTenderReference);
  const nestContractReference = nullableString(value.nestContractReference);
  const ocid = nullableString(value.ocid);
  const procuringEntity = nullableString(value.procuringEntity);
  const contractStatus = nullableString(value.contractStatus);
  const contractStartDate = nullableString(value.contractStartDate);
  const contractEndDate = nullableString(value.contractEndDate);
  if (!id || !contractorId || !name || !nestSource || !createdAt || !updatedAt) {
    return null;
  }
  if (
    description === undefined ||
    nestTenderReference === undefined ||
    nestContractReference === undefined ||
    ocid === undefined ||
    procuringEntity === undefined ||
    contractStatus === undefined ||
    contractStartDate === undefined ||
    contractEndDate === undefined
  ) {
    return null;
  }

  return {
    id,
    contractorId,
    name,
    description,
    nestTenderReference,
    nestContractReference,
    ocid,
    procuringEntity,
    contractStatus,
    contractStartDate,
    contractEndDate,
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
