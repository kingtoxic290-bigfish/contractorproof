import { Role } from "@prisma/client";
import { userRepository } from "../repositories/user.repository";
import { prisma } from "../repositories/prisma";
import {
  ATTEST_ROLES,
  PRIVILEGED_ROLES,
  PUBLIC_REGISTER_ROLES,
  type PublicUser,
} from "../types";
import { hashPassword, verifyPasswordOrDummy } from "../utils/password";
import { signAccessToken } from "../utils/jwt";
import { HttpError } from "../middleware/errorHandler";
import { ApiError } from "../http/errors";
import { isValidCrbReference } from "../integrations/crb";

function toPublicUser(user: { id: string; email: string; fullName: string; role: Role }): PublicUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
  };
}

function isPublicRegisterRole(role: string): role is (typeof PUBLIC_REGISTER_ROLES)[number] {
  return (PUBLIC_REGISTER_ROLES as readonly string[]).includes(role);
}

function isPrivilegedRole(role: string): boolean {
  return (PRIVILEGED_ROLES as readonly string[]).includes(role);
}

export const authService = {
  async register(input: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    crbRegistrationNumber?: unknown;
  }): Promise<{ token: string; user: PublicUser }> {
    const email = input.email.trim();
    const fullName = input.fullName.trim();
    const role = String(input.role ?? "").trim();

    if (!email || !input.password || !fullName) {
      throw new HttpError(400, "email, password, and fullName are required");
    }
    if (input.password.length < 8) {
      throw new HttpError(400, "password must be at least 8 characters");
    }
    if (role === Role.ADMIN || isPrivilegedRole(role) || !isPublicRegisterRole(role)) {
      throw new HttpError(400, "role is not allowed for public registration");
    }

    const crbRegistrationNumber = typeof input.crbRegistrationNumber === "string"
      ? input.crbRegistrationNumber.trim().toUpperCase()
      : "";
    if (input.crbRegistrationNumber !== undefined &&
      (role !== Role.CONTRACTOR || !isValidCrbReference(crbRegistrationNumber))) {
      throw new HttpError(400, "CRB registration number is invalid");
    }
    if (crbRegistrationNumber) {
      const existingContractor = await prisma.contractor.findFirst({
        where: { crbRegistrationNumber: { equals: crbRegistrationNumber, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingContractor) {
        throw new HttpError(409, "CRB registration number is already registered");
      }
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new HttpError(409, "email is already registered");
    }

    const passwordHash = await hashPassword(input.password);
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          passwordHash,
          fullName,
          role,
        },
      });
      if (role === Role.CONTRACTOR) {
        // No CRB fields are asserted here. crbSource/crbStatus stay null until a
        // real check runs against a CRB adapter, so registering an account can
        // never be mistaken for a CRB registration result.
        await tx.contractor.create({
          data: {
            userId: created.id,
            legalName: fullName,
            crbRegistrationNumber: crbRegistrationNumber || null,
          },
        });
      }
      return created;
    });

    const publicUser = toPublicUser(user);
    return {
      token: signAccessToken({
        sub: publicUser.id,
        email: publicUser.email,
        role: publicUser.role,
      }),
      user: publicUser,
    };
  },

  async login(input: { email: string; password: string }): Promise<{ token: string; user: PublicUser }> {
    const user = await userRepository.findByEmail(input.email.trim());
    const matches = await verifyPasswordOrDummy(user?.passwordHash, input.password);
    if (!user || !matches) {
      throw new HttpError(401, "invalid email or password");
    }
    const publicUser = toPublicUser(user);
    return {
      token: signAccessToken({
        sub: publicUser.id,
        email: publicUser.email,
        role: publicUser.role,
      }),
      user: publicUser,
    };
  },

  async me(userId: string): Promise<PublicUser> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new HttpError(401, "user not found");
    }
    return toPublicUser(user);
  },

  async provisionPrivilegedUser(input: {
    actor: PublicUser;
    email: string;
    password: string;
    fullName: string;
    role: string;
  }): Promise<PublicUser> {
    if (input.actor.role !== Role.ADMIN) {
      throw new ApiError(403, "FORBIDDEN", "insufficient permission");
    }
    const email = input.email.trim();
    const fullName = input.fullName.trim();
    const role = String(input.role ?? "").trim() as Role;
    if (!email || !input.password || !fullName) {
      throw new ApiError(400, "VALIDATION_ERROR", "email, password, and fullName are required");
    }
    if (input.password.length < 8) {
      throw new ApiError(400, "VALIDATION_ERROR", "password must be at least 8 characters");
    }
    if (!Object.values(Role).includes(role)) {
      throw new ApiError(400, "VALIDATION_ERROR", "role is invalid");
    }
    if (role === Role.CONTRACTOR || role === Role.CLIENT) {
      throw new ApiError(400, "VALIDATION_ERROR", "use public registration for CONTRACTOR and CLIENT");
    }
    if (!(ATTEST_ROLES as readonly string[]).includes(role) && role !== Role.ADMIN) {
      throw new ApiError(400, "VALIDATION_ERROR", "role is not allowed");
    }

    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new ApiError(409, "CONFLICT", "email is already registered");
    }

    const created = await userRepository.create({
      email,
      passwordHash: await hashPassword(input.password),
      fullName,
      role,
    });
    return toPublicUser(created);
  },
};
