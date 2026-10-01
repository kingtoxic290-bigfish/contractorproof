import { useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { useContractors } from "../../contractors/hooks/useContractors";
import { userFacingError } from "../../../services/api/errors";
import { assignProjectContractor } from "../api/projectsApi";
import type { PublicProject } from "../types";

export function ContractorAssignmentPanel({
  projectId,
  contractorId,
  onAssigned,
}: {
  projectId: string;
  contractorId: string;
  onAssigned: (project: PublicProject) => void;
}) {
  const contractors = useContractors();
  const [selectedContractorId, setSelectedContractorId] = useState(contractorId);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!selectedContractorId || selectedContractorId === contractorId) return;
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await assignProjectContractor(projectId, selectedContractorId);
      setMessage(`Project assigned to ${updated.contractorName}.`);
      onAssigned(updated);
    } catch (cause) {
      setError(userFacingError(cause, "The contractor assignment could not be updated."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="mb-4 border-b border-stone-200 pb-4" aria-labelledby="assignment-heading">
      <h3 id="assignment-heading" className="flex items-center gap-2 text-sm font-semibold text-stone-900">
        <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> Assign Contractor
      </h3>
      <p className="mt-1 text-sm text-stone-600">The backend grants project access to the selected contractor after assignment.</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm" htmlFor={`assign-contractor-${projectId}`}>
          <span className="mb-1 block font-medium text-stone-800">Contractor</span>
          <select
            id={`assign-contractor-${projectId}`}
            value={selectedContractorId}
            onChange={(event) => {
              setSelectedContractorId(event.target.value);
              setMessage(null);
              setError(null);
            }}
            disabled={contractors.status === "loading" || contractors.records.length === 0 || submitting}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            {contractors.records.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.legalName}{contractor.crbRegistrationNumber ? ` · ${contractor.crbRegistrationNumber}` : ""}
              </option>
            ))}
          </select>
        </label>
        <Button type="button" variant="secondary" disabled={submitting || !selectedContractorId || selectedContractorId === contractorId} onClick={() => void submit()}>
          {submitting ? "Assigning..." : "Confirm Assignment"}
        </Button>
      </div>
      {contractors.status === "error" || contractors.status === "forbidden" || contractors.status === "unauthorized" ? (
        <ErrorState message={contractors.error ?? "Contractors could not be loaded."} onRetry={() => void contractors.retry()} />
      ) : null}
      {contractors.status === "empty" ? <p className="mt-2 text-sm text-stone-600">No contractors are available to assign.</p> : null}
      {error ? <ErrorState message={error} /> : null}
      {message ? <p className="mt-3 text-sm font-medium text-emerald-800" role="status">{message}</p> : null}
    </section>
  );
}