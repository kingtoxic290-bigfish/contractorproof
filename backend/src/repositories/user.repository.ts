import type { Role } from "@prisma/client";
import { prisma } from "./prisma";

export const userRepository = {
  findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
  },

  findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
    });
  },

  create(input: {
    email: string;
    passwordHash: string;
    fullName: string;
    role: Role;
  }) {
    return prisma.user.create({
      data: {
        email: input.email.toLowerCase(),
        passwordHash: input.passwordHash,
        fullName: input.fullName,
        role: input.role,
      },
    });
  },
};
