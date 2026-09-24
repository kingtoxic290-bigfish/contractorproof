import { FormEvent, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { RecordFields } from "../../shared/RecordFields";
import { useCrbLookup } from "../hooks/useCrbLookup";

export function CrbLookupForm() {
  const [registrationNumber, setRegistrationNumber] = useState("");
  const { pending, result, error, search } = useCrbLookup();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!registrationNumber.trim()) {
      return;
    }
    void search(registrationNumber);
  }

  return (
    <Card
      title="Synthetic CRB reference lookup"
      description="This uses the mock CRB adapter. No live CRB API is called. Results are labeled SYNTHETIC_DEMO."
    >
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="block min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium text-stone-800">CRB registration number</span>
          <input
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            value={registrationNumber}
            onChange={(event) => setRegistrationNumber(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <Button type="submit" disabled={pending}>
          Look up
        </Button>
      </form>
      <div className="mt-4">
        {pending ? <LoadingState message="Looking up the CRB reference..." /> : null}
        {error ? <ErrorState message={error} onRetry={() => void search(registrationNumber)} /> : null}
        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">{result.notice}</p>
            <p className="text-sm text-stone-800">
              {result.found ? "A synthetic record was found." : "No synthetic record matched that number."}
            </p>
            <RecordFields
              record={{
                source: result.source,
                crbRegistrationNumber: result.crbRegistrationNumber,
                crbCategory: result.crbCategory,
                crbType: result.crbType,
                crbClass: result.crbClass,
                crbStatus: result.crbStatus,
                crbLastVerifiedAt: result.crbLastVerifiedAt,
              }}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
