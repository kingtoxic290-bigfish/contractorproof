import { Link, useLocation } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";

export function UnauthorizedPage() {
  const location = useLocation();
  const { status, message } = useAuth();
  const routeState = location.state as { reason?: string } | null;
  const expired = status === "SESSION_EXPIRED" || routeState?.reason === "expired";

  return (
    <Card title={expired ? "Session expired" : "Sign in required"}>
      <p className="text-sm leading-6 text-stone-700">
        {expired
          ? message ?? "Your session has expired. Please sign in again."
          : "You need to sign in to view this page."}
      </p>
      <p className="mt-3">
        <Link
          to="/login"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Go to login
        </Link>
      </p>
    </Card>
  );
}
