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
};
