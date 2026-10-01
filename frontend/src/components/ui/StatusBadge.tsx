import { STATUS_LABELS, type EvidenceStatus } from "../../types/status";
import { cn } from "../../utils/cn";
import { stateTone } from "./statusTone";

/**
 * Status badge for verification and evidence workflow states.
 *
 * The state name is always rendered as text alongside its icon, so the badge is
 * never communicated by colour alone. Unknown states fall back to a neutral tone
 * rather than being guessed at.
 */
export function StatusBadge({ status, className }: { status: EvidenceStatus; className?: string }) {
  const { tone, icon: Icon } = stateTone(status);
  const label = STATUS_LABELS[status] ?? status;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em]",
        tone,
        className,
      )}
      aria-label={label}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}