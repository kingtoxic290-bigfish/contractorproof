import { workflowReviewTone } from "../../components/ui/statusTone";
import { cn } from "../../utils/cn";

/**
 * Badge for correction and dispute workflow states.
 *
 * The backend status is rendered verbatim. No wording is substituted, so a
 * correction is never presented as a technical verification outcome.
 */
export function WorkflowStatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const { tone, icon: Icon } = workflowReviewTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.06em]",
        tone,
        className,
      )}
      aria-label={`Status: ${status}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      <span>{status}</span>
    </span>
  );
}