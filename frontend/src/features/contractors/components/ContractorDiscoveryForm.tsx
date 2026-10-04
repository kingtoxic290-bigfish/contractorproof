import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ContractorSummary } from "./ContractorSummary";
import { useContractorDiscovery } from "../hooks/useContractorDiscovery";

/**
 * Contractor discovery.
 *
 * The key is the CRB Registration Number. ContractorProof matches that number
 * against its own contractor records; it does not replace CRB registration and
 * no live CRB lookup is performed here.
 */
export function ContractorDiscoveryForm() {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const { status, records, error, lastQuery, search, reset } = useContractorDiscovery();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = registrationNumber.trim();
    if (!trimmed) {
      return;
    }
    void search(trimmed);
  }

  return (
    <Card
      title="Find a contractor"
      description="Search by CRB Registration Number. ContractorProof matches the number against its own contractor records; it does not replace or verify CRB registration."
      icon={Search}
    >
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="block min-w-0 flex-1 text-sm" htmlFor="crb-registration-search">
          <span className="mb-1 block font-medium text-stone-800">Search by CRB Registration Number</span>
          <input
            id="crb-registration-search"
            name="crbRegistrationNumber"
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <Button type="submit" disabled={status === "pending"}>
          {status === "pending" ? "Searching..." : "Search"}
        </Button>
      </form>

      <div className="mt-4">
        {status === "pending" ? <LoadingState message="Searching contractor records..." /> : null}
        {status === "error" || status === "forbidden" || status === "unauthorized" ||
        status === "unavailable" ? (
          <ErrorState
            message={error ?? "We couldn't run this search. Please try again."}
            onRetry={() => void search(registrationNumber.trim())}
          />
        ) : null}

        {status === "empty" || status === "notfound" ? (
          <EmptyState
            title="No matching ContractorProof contractor."
            description={`No ContractorProof contractor record matches ${lastQuery ?? registrationNumber.trim()}. The number may not be registered with ContractorProof, or it may be recorded differently.`}
          />
        ) : null}

        {status === "idle" ? (
          <p className="text-sm text-stone-600">
            Enter a CRB Registration Number to find a contractor and open their Passport.
          </p>
        ) : null}

        {status === "success" ? (
          <ul className="grid gap-4">
            {records.map((record) => (
              <li key={record.id}>
                <ContractorSummary
                  contractor={record}
                  actions={
                    <>
                      <Link
                        to={`/contractors/${encodeURIComponent(record.id)}`}
                        className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                      >
                        View contractor
                      </Link>
                      <Link
                        to={`/contractors/${encodeURIComponent(record.id)}/passport`}
                        className="text-sm font-semibold text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                      >
                        Open Contractor Passport
                      </Link>
                    </>
                  }
                />
              </li>
            ))}
          </ul>
        ) : null}

        {status === "success" ? (
          <p className="mt-3 text-sm text-stone-600">
            Next step: open the Contractor Passport to review this contractor&apos;s recorded
            project history, then select the contractor to create or assign a project.
          </p>
        ) : null}

        {status === "success" || status === "empty" || status === "notfound" ? (
          <p className="mt-3">
            <button
              type="button"
              className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              onClick={reset}
            >
              Clear search
            </button>
          </p>
        ) : null}

        {status === "empty" || status === "notfound" ? (
          <p className="mt-3 text-sm text-stone-600">
            ContractorProof does not replace CRB registration. Confirm the number with the
            contractor, or browse the contractor list.
          </p>
        ) : null}
      </div>
    </Card>
  );
}