import { STATUS_LABELS, type EvidenceStatus } from "../../types/status";
import { cn } from "../../utils/cn";

const TONE: Record<EvidenceStatus, string> = {
  MATCH: "border-teal-700 text-teal-900",
  MISMATCH: "border-red-800 text-red-900",
  PENDING: "border-amber-700 text-amber-950",
  UNAVAILABLE: "border-stone-400 text-stone-700",
  VERIFIED: "border-teal-700 text-teal-900",
  REJECTED: "border-red-800 text-red-900",
  DISPUTED: "border-amber-800 text-amber-950",
};

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white px-2.5 py-1 text-xs font-medium",
        TONE[status],
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
