import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/**
 * Definition-list field used across record pages.
 *
 * Every field renders an explicit `<dt>` label so values are never conveyed by
 * position or colour alone, and long identifiers wrap instead of overflowing.
 */
export function Field({
  label,
  children,
  className,
  mono = false,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
        {label}
      </dt>
      <dd
        className={cn(
          "mt-1 break-words text-sm text-stone-900",
          mono && "font-mono text-xs leading-5",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

/** Label/value grid with the shared responsive column behaviour. */
export function FieldGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <dl className={cn("grid gap-4 sm:grid-cols-2", className)}>{children}</dl>;
}

/**
 * Monospace identifier/hash display that wraps on narrow viewports instead of
 * forcing horizontal overflow. The full value is always rendered as text.
 */
export function HashValue({ value, className }: { value: string; className?: string }) {
  return (
    <code
      className={cn(
        "block min-w-0 break-all font-mono text-xs leading-5 text-stone-900",
        className,
      )}
    >
      {value}
    </code>
  );
}