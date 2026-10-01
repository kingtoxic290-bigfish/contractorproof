import { FileQuestion } from "lucide-react";
import { Link } from "react-router-dom";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { useAuth } from "../hooks/useAuth";

/**
 * Shown when a URL does not match any route.
 *
 * It reports only what is known: the address does not correspond to a screen in
 * this application. It never guesses at a replacement record and never implies
 * that a record exists.
 */
export function NotFoundPage() {
  const { user } = useAuth();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Page not found"
        description="The address you requested does not correspond to a page in ContractorProof."
        icon={FileQuestion}
      />
      <Card>
        <p className="text-sm leading-6 text-stone-700">
          Nothing was loaded for this address. If you followed a link to a specific
          record, return to a list and open the record from there. Record access is
          enforced by the service, so a record you are not permitted to view is
          reported as unavailable rather than as a page.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {user ? (
            <Link
              to="/dashboard"
              className="font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
            >
              Return to dashboard
            </Link>
          ) : null}
          <Link
            to="/verify"
            className="font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          >
            Public verification
          </Link>
        </div>
      </Card>
    </section>
  );
}