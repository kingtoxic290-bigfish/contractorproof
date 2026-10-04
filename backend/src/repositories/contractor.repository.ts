import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const contractorWithPublicUser = {
  include: {
    user: {
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
      },
    },
  },
} satisfies Prisma.ContractorDefaultArgs;

export type ContractorWithPublicUser = Prisma.ContractorGetPayload<
  typeof contractorWithPublicUser
>;

export const contractorRepository = {
  listContractors(): Promise<ContractorWithPublicUser[]> {
    return prisma.contractor.findMany({
      ...contractorWithPublicUser,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },

  getContractorById(id: string): Promise<ContractorWithPublicUser | null> {
    return prisma.contractor.findUnique({
      where: { id },
      ...contractorWithPublicUser,
    });
  },

  getContractorByUserId(userId: string): Promise<ContractorWithPublicUser | null> {
    return prisma.contractor.findUnique({
      where: { userId },
      ...contractorWithPublicUser,
    });
  },

  findByCrbRegistrationNumber(crbRegistrationNumber: string): Promise<ContractorWithPublicUser | null> {
    return prisma.contractor.findFirst({
      where: { crbRegistrationNumber: { equals: crbRegistrationNumber, mode: "insensitive" } },
      ...contractorWithPublicUser,
    });
  },

  findAccessible(where: Prisma.ContractorWhereInput): Promise<ContractorWithPublicUser[]> {
    return prisma.contractor.findMany({
      where,
      ...contractorWithPublicUser,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    });
  },
};
