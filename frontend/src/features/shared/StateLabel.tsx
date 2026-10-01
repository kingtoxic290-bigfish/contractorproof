import { isKnownStatus, stateTone } from "../../components/ui/statusTone";
import { cn } from "../../utils/cn";

/**
 * Compact state chip used for workflow, milestone, contract and record states.
 *
 * The raw state value is always rendered as text, so state is never conveyed by
 * colour alone. Known states pick up their canonical tone and icon; anything
 * else is shown neutrally rather than being reinterpreted.
 */
export function StateLabel({ value, className }: { value: string; className?: string }) {
  const known = isKnownStatus(value);
  const { tone, icon: Icon } = stateTone(value);

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold",
        known ? tone : "border-stone-300 bg-stone-50 text-stone-700",
        className,
      )}
    >
      {known ? <Icon className="h-3 w-3 shrink-0" aria-hidden="true" /> : null}
      <span className="break-words">{value}</span>
    </span>
  );
}