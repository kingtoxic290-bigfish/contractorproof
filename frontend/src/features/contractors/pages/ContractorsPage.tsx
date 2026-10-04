import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { ContractorList } from "../components/ContractorList";
import { ContractorDiscoveryForm } from "../components/ContractorDiscoveryForm";
import { useContractors } from "../hooks/useContractors";

export function ContractorsPage() {
  const { status, records, error, retry } = useContractors();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractors"
        description="Find a contractor by CRB Registration Number and review their Contractor Passport. ContractorProof does not replace or verify CRB registration, and it does not calculate a trust score or performance rating."
      />
      <ContractorDiscoveryForm />
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
    </section>
  );
}
