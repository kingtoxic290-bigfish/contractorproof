import { StateLabel } from "../../shared/StateLabel";

/**
 * Shows the two independent states of an evidence record side by side:
 * the workflow state of the record, and the fingerprint comparison result.
 *
 * Both are labelled explicitly so neither is communicated by colour alone, and
 * they are never merged into a single overall judgement.
 */
export function EvidenceStatus({
  status,
  verificationStatus,
}: {
  status: string;
  verificationStatus: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
          Workflow
        </span>
        <StateLabel value={status} />
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
          Fingerprint comparison
        </span>
        <StateLabel value={verificationStatus} />
      </span>
    </div>
  );
}