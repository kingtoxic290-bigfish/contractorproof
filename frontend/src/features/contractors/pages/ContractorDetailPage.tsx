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
        description="Contractor identity and registration fields. Open the live Contractor Passport to review the project history recorded for this contractor."
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
      <Card title="Contractor Passport" description="The live Contractor Passport presents this contractor's recorded identity, project history, milestones, evaluations and proof. It contains no rating or recommendation.">
        <p className="text-sm text-stone-600">
          Open the passport, then select this contractor from there.
        </p>
        <p className="mt-3">
          <Link
            to={`/contractors/${encodeURIComponent(contractorId ?? "")}/passport`}
            className="text-sm font-semibold text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Open Contractor Passport
          </Link>
        </p>
        <p className="mt-3">
          <Link
            to="/passports"
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            View project Passports
          </Link>
        </p>
      </Card>
    </section>
  );
}