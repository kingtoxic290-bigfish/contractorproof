import { StateLabel } from "../../shared/StateLabel";

export function EvidenceStatus({
  status,
  verificationStatus,
}: {
  status: string;
  verificationStatus: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="sr-only">
        Workflow status {status}. Fingerprint comparison status {verificationStatus}.
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-stone-500">Workflow</span>
        <StateLabel value={status} />
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="text-xs text-stone-500">Fingerprint compare</span>
        <StateLabel value={verificationStatus} />
      </span>
    </div>
  );
}
