import { ShieldOff } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";

export function ForbiddenPage() {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Access denied"
        description="Your account does not have permission to view this area."
        icon={ShieldOff}
      />
      <Card>
        <p className="text-sm leading-6 text-stone-700">
          You are signed in, but this area is not available for your role. Access decisions are
          enforced by the server, not only by this screen.
        </p>
        <p className="mt-3">
          <Link
            to="/dashboard"
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Return to dashboard
          </Link>
        </p>
      </Card>
    </section>
  );
}
