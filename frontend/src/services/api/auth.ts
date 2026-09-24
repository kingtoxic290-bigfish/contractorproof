import type { PublicUser } from "../../types/auth";
import { isRole } from "../../types/roles";
import { apiRequest } from "./client";

type AuthResponse = {
  token: string;
  user: PublicUser;
};

function normalizeUser(user: PublicUser): PublicUser {
  if (!isRole(user.role)) {
    throw new Error("The server returned an unrecognized role.");
  }
  return user;
}

export const authApi = {
  async login(input: { email: string; password: string }): Promise<AuthResponse> {
    const result = await apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
    return { token: result.token, user: normalizeUser(result.user) };
  },

  async register(input: {
    email: string;
    password: string;
    fullName: string;
    role: string;
  }): Promise<AuthResponse> {
    const result = await apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: input,
      skipAuthRedirect: true,
    });
    return { token: result.token, user: normalizeUser(result.user) };
  },

  async me(): Promise<PublicUser> {
    const result = await apiRequest<{ user: PublicUser }>("/auth/me");
    return normalizeUser(result.user);
  },
};
