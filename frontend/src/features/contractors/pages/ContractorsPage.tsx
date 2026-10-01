import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { ContractorList } from "../components/ContractorList";
import { CrbLookupForm } from "../components/CrbLookupForm";
import { useContractors } from "../hooks/useContractors";

export function ContractorsPage() {
  const { status, records, error, retry } = useContractors();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractors"
        description="Registered contractor records. This screen does not calculate a trust score or performance rating."
      />
      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading contractor information..."
        emptyTitle="No contractors available."
        emptyDescription="No contractor records were found for this account."
      >
        <ContractorList records={records} />
      </QueryPanel>
      <CrbLookupForm />
    </section>
  );
}
