import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * Standard empty state.
 *
 * Empty means "the service returned no records", which is different from an
 * error. The wording is always factual and never implies a judgement or a
 * fabricated metric.
 */
export function EmptyState({
  title = "No records available.",
  description = "The service returned no records for this view.",
  icon: Icon = Inbox,
  action,
  className,
}: {
  title?: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center",
        className,
      )}
    >
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full border border-stone-200 bg-white text-stone-500">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-3 text-sm font-semibold text-stone-900">{title}</p>
      <p className="mx-auto mt-1 max-w-prose text-sm leading-6 text-stone-600">{description}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}