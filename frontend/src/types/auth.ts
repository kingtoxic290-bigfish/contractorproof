import type { Role } from "./roles";

export type AuthStatus =
  | "LOGGED_OUT"
  | "AUTHENTICATING"
  | "AUTHENTICATED"
  | "SESSION_EXPIRED"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "AUTH_ERROR";

export type PublicUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

export type AuthSession = {
  status: AuthStatus;
  user: PublicUser | null;
  message: string | null;
};
