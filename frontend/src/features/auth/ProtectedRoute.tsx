import { Navigate, useLocation } from "react-router-dom";
import { LoadingState } from "../../components/feedback/LoadingState";
import { useAuth } from "../../hooks/useAuth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "AUTHENTICATING") {
    return <LoadingState message="Restoring your session..." />;
  }

  if (status === "AUTHENTICATED") {
    return children;
  }

  if (status === "SESSION_EXPIRED") {
    return <Navigate to="/unauthorized" replace state={{ from: location.pathname, reason: "expired" }} />;
  }

  return <Navigate to="/unauthorized" replace state={{ from: location.pathname }} />;
}
