import { FormEvent, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { RecordFields } from "../../shared/RecordFields";
import { useNestLookup } from "../hooks/useNestLookup";

export function NestLookupForm() {
  const [reference, setReference] = useState("");
  const { pending, result, error, search } = useNestLookup();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reference.trim()) {
      return;
    }
    void search(reference);
  }

  return (
    <Card
      title="Synthetic NeST reference lookup"
      description="This uses the mock NeST adapter. No live NeST API is called. Results are labeled SYNTHETIC_DEMO."
    >
      <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <label className="block min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium text-stone-800">NeST tender or contract reference</span>
          <input
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            value={reference}
            onChange={(event) => setReference(event.target.value)}
            autoComplete="off"
            required
          />
        </label>
        <Button type="submit" disabled={pending}>
          Look up
        </Button>
      </form>
      <div className="mt-4">
        {pending ? <LoadingState message="Looking up the NeST reference..." /> : null}
        {error ? <ErrorState message={error} onRetry={() => void search(reference)} /> : null}
        {result ? (
          <div className="space-y-3">
            <p className="text-sm text-stone-600">{result.notice}</p>
            <p className="text-sm text-stone-800">
              {result.found ? "A synthetic record was found." : "No synthetic record matched that reference."}
            </p>
            <RecordFields
              record={{
                source: result.source,
                nestTenderReference: result.nestTenderReference,
                nestContractReference: result.nestContractReference,
                ocid: result.ocid,
                procuringEntity: result.procuringEntity,
                contractStatus: result.contractStatus,
                contractStartDate: result.contractStartDate,
                contractEndDate: result.contractEndDate,
              }}
            />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
