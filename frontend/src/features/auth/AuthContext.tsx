import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { authApi } from "../../services/api/auth";
import { ApiError } from "../../services/api/errors";
import { onUnauthorized } from "../../services/api/client";
import type { AuthStatus, PublicUser } from "../../types/auth";
import type { Role } from "../../types/roles";
import { clearSessionToken, hasSessionToken, writeSessionToken } from "../../utils/session";

type AuthContextValue = {
  status: AuthStatus;
  user: PublicUser | null;
  message: string | null;
  login: (input: { email: string; password: string }) => Promise<void>;
  register: (input: {
    email: string;
    password: string;
    fullName: string;
    role: string;
  }) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: Role[]) => boolean;
  restoreSession: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(
    hasSessionToken() ? "AUTHENTICATING" : "LOGGED_OUT",
  );
  const [user, setUser] = useState<PublicUser | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const expireSession = useCallback((nextStatus: AuthStatus, nextMessage: string) => {
    clearSessionToken();
    setUser(null);
    setStatus(nextStatus);
    setMessage(nextMessage);
  }, []);

  const restoreSession = useCallback(async () => {
    if (!hasSessionToken()) {
      setUser(null);
      setStatus("LOGGED_OUT");
      return;
    }

    setStatus("AUTHENTICATING");
    setMessage(null);
    try {
      const current = await authApi.me();
      setUser(current);
      setStatus("AUTHENTICATED");
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthorized) {
        expireSession("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
        return;
      }
      setStatus("AUTH_ERROR");
      setMessage("We couldn't restore your session. Please try again.");
    }
  }, [expireSession]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    onUnauthorized(() => {
      expireSession("SESSION_EXPIRED", "Your session has expired. Please sign in again.");
    });
    return () => onUnauthorized(null);
  }, [expireSession]);

  const login = useCallback(async (input: { email: string; password: string }) => {
    setStatus("AUTHENTICATING");
    setMessage(null);
    try {
      const result = await authApi.login(input);
      writeSessionToken(result.token);
      setUser(result.user);
      setStatus("AUTHENTICATED");
    } catch (error) {
      clearSessionToken();
      setUser(null);
      if (error instanceof ApiError && error.isUnauthorized) {
        setStatus("UNAUTHORIZED");
        setMessage("The email or password is incorrect.");
        return;
      }
      setStatus("AUTH_ERROR");
      setMessage("We couldn't sign you in. Please try again.");
      throw error;
    }
  }, []);

  const register = useCallback(
    async (input: { email: string; password: string; fullName: string; role: string }) => {
      setStatus("AUTHENTICATING");
      setMessage(null);
      try {
        const result = await authApi.register(input);
        writeSessionToken(result.token);
        setUser(result.user);
        setStatus("AUTHENTICATED");
      } catch (error) {
        clearSessionToken();
        setUser(null);
        setStatus("AUTH_ERROR");
        setMessage(
          error instanceof ApiError
            ? error.message
            : "We couldn't create the account. Please try again.",
        );
        throw error;
      }
    },
    [],
  );

  const logout = useCallback(() => {
    clearSessionToken();
    setUser(null);
    setStatus("LOGGED_OUT");
    setMessage(null);
  }, []);

  const hasRole = useCallback(
    (...roles: Role[]) => Boolean(user && roles.includes(user.role)),
    [user],
  );

  const value = useMemo(
    () => ({
      status,
      user,
      message,
      login,
      register,
      logout,
      hasRole,
      restoreSession,
    }),
    [status, user, message, login, register, logout, hasRole, restoreSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
