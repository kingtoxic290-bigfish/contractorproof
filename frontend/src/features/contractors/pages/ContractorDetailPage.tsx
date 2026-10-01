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
        description="Contractor identity and registration fields. Open the Passports section to review project evidence history associated with this contractor."
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
      <Card title="Associated projects" description="Project evidence history for this contractor is available through the Passport section.">
        <p className="text-sm text-stone-600">
          Passports show project milestones, evidence records, verification outcomes, and blockchain proof events authorized for your account.
        </p>
        <p className="mt-3">
          <Link
            to="/passports"
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            View Contractor Passports
          </Link>
        </p>
      </Card>
    </section>
  );
}
