import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { RecordFields } from "../../shared/RecordFields";
import { useContractor } from "../hooks/useContractor";

export function ContractorDetailPage() {
  const { contractorId } = useParams();
  const { status, data, error, retry } = useContractor(contractorId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractor"
        description="Only fields returned by the contractor API are shown. Associated projects will appear when that API is available."
      />
      <p>
        <Link
          to="/contractors"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to contractors
        </Link>
      </p>
      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading contractor information..."
      >
        {data ? (
          <Card title="Contractor record">
            <RecordFields record={data} />
          </Card>
        ) : null}
      </QueryPanel>
      <Card title="Associated projects" description="A contractor-to-projects list is not provided by the current API.">
        <p className="text-sm text-stone-600">
          Project records can be opened from the projects module when that API returns data.
        </p>
        {contractorId ? (
          <p className="mt-3">
            <Link
              to={`/passports/${encodeURIComponent(contractorId)}`}
              className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              View project history
            </Link>
          </p>
        ) : null}
      </Card>
    </section>
  );
}
