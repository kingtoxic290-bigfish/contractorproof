import {
  AlertTriangle,
  CheckCircle2,
  CircleOff,
  Clock3,
  type LucideIcon,
} from "lucide-react";
import { STATUS_LABELS, type EvidenceStatus } from "../../types/status";
import { cn } from "../../utils/cn";

const BADGE: Record<EvidenceStatus, { tone: string; icon: LucideIcon }> = {
  MATCH: { tone: "border-[#166534] bg-[#dcfce7] text-[#166534]", icon: CheckCircle2 },
  MISMATCH: { tone: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]", icon: AlertTriangle },
  PENDING: { tone: "border-[#92400e] bg-[#fef3c7] text-[#92400e]", icon: Clock3 },
  UNAVAILABLE: { tone: "border-stone-400 bg-stone-100 text-stone-700", icon: CircleOff },
  VERIFIED: { tone: "border-[#166534] bg-[#dcfce7] text-[#166534]", icon: CheckCircle2 },
  REJECTED: { tone: "border-[#991b1b] bg-[#fee2e2] text-[#991b1b]", icon: AlertTriangle },
  DISPUTED: { tone: "border-[#92400e] bg-[#fef3c7] text-[#92400e]", icon: Clock3 },
};

export function StatusBadge({ status }: { status: EvidenceStatus }) {
  const Icon = BADGE[status].icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.08em]",
        BADGE[status].tone,
      )}
      aria-label={STATUS_LABELS[status]}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{STATUS_LABELS[status]}</span>
    </span>
  );
}
