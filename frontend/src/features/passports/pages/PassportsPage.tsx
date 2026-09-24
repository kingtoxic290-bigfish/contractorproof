import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useContractors } from "../../contractors/hooks/useContractors";
import { QueryPanel } from "../../shared/QueryPanel";
import { useOfficialPassport } from "../hooks/useOfficialPassport";

export function PassportsPage() {
  const official = useOfficialPassport();
  const contractors = useContractors();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Performance passports"
        description="A passport is an evidence-backed project history. It is not a trust score, rating, ranking, or percentage. GET /api/v1/passports is not implemented; this index uses GET /api/v1/contractors."
      />

      <Card
        title="Official passport projection"
        description="The backend registers GET /api/v1/passports and GET /api/v1/passports/:projectId as JWT-authenticated 501 stubs. No derived passport document is returned."
      >
        <QueryPanel
          status={official.status}
          error={official.error}
          onRetry={() => void official.retry()}
          loadingMessage="Checking the passport projection..."
        >
          <p className="text-sm text-stone-600">
            The passport projection returned a body that is not in a known format. No passport
            fields are shown.
          </p>
        </QueryPanel>
      </Card>

      <Card
        title="Contractor project history"
        description="Open a contractor to see projects, milestones, and evidence returned by implemented GET APIs. This is not GET /passports."
      >
        <QueryPanel
          status={contractors.status}
          error={contractors.error}
          onRetry={() => void contractors.retry()}
          loadingMessage="Loading contractor information..."
          emptyTitle="No contractors available."
          emptyDescription="GET /api/v1/contractors returned no records."
        >
          <ul className="grid gap-3">
            {contractors.records.map((contractor) => (
              <li key={contractor.id}>
                <Link
                  to={`/passports/${encodeURIComponent(contractor.id)}`}
                  className="block rounded-md border border-stone-200 px-3 py-3 hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  <p className="text-sm font-medium text-stone-900">{contractor.legalName}</p>
                  <p className="mt-1 text-sm text-stone-600">{contractor.user.fullName}</p>
                </Link>
              </li>
            ))}
          </ul>
        </QueryPanel>
      </Card>
    </section>
  );
}
