import { Navigate } from "react-router-dom";
import { LoadingState } from "../../components/feedback/LoadingState";
import { useAuth } from "../../hooks/useAuth";

export function GuestRoute({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();

  if (status === "AUTHENTICATING") {
    return <LoadingState message="Checking your session..." />;
  }

  if (status === "AUTHENTICATED") {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
