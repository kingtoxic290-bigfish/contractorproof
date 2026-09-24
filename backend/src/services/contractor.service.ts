import { HttpError } from "../middleware/errorHandler";
import {
  contractorRepository,
  type ContractorWithPublicUser,
} from "../repositories/contractor.repository";
import type { PublicContractor } from "../types";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toIsoString(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

function toPublicContractor(row: ContractorWithPublicUser): PublicContractor {
  return {
    id: row.id,
    userId: row.userId,
    legalName: row.legalName,
    crbRegistrationNumber: row.crbRegistrationNumber,
    crbCategory: row.crbCategory,
    crbType: row.crbType,
    crbClass: row.crbClass,
    crbStatus: row.crbStatus,
    crbLastVerifiedAt: toIsoString(row.crbLastVerifiedAt),
    crbSource: row.crbSource,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    user: {
      id: row.user.id,
      email: row.user.email,
      fullName: row.user.fullName,
      role: row.user.role,
    },
  };
}

export const contractorService = {
  async list(): Promise<PublicContractor[]> {
    const rows = await contractorRepository.listContractors();
    return rows.map(toPublicContractor);
  },

  async getById(contractorId: string | undefined): Promise<PublicContractor> {
    if (!contractorId || !UUID_PATTERN.test(contractorId)) {
      throw new HttpError(400, "contractorId must be a valid UUID");
    }

    const row = await contractorRepository.getContractorById(contractorId);
    if (!row) {
      throw new HttpError(404, "contractor not found");
    }

    return toPublicContractor(row);
  },
};
