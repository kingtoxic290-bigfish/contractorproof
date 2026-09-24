import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import type { Role } from "../../types/roles";

export function RoleGate({
  allow,
  children,
}: {
  allow: Role[];
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();

  if (status !== "AUTHENTICATED" || !user) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (!allow.includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return children;
}
