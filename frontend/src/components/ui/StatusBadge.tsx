import { STATUS_LABELS, type EvidenceStatus } from "../../types/status";
import { cn } from "../../utils/cn";

const TONE: Record<EvidenceStatus, string> = {
  MATCH: "border-[#166534] bg-[#dcfce7] text-[#166534]",
  MISMATCH: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]",
  PENDING: "border-[#92400e] bg-[#fef3c7] text-[#92400e]",
  UNAVAILABLE: "border-stone-400 bg-stone-100 text-stone-700",
  VERIFIED: "border-[#166534] bg-[#dcfce7] text-[#166534]",
  REJECTED: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]",
  DISPUTED: "border-[#92400e] bg-[#fef3c7] text-[#92400e]",
};

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
        TONE[status],
      )}
      aria-label={STATUS_LABELS[status]}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
