import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/** Shared surface treatment so every card in the product matches exactly. */
export const CARD_SURFACE =
  "rounded-xl border border-stone-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Shared icon-chip treatment used by Card, Section and Panel headers. */
export const CARD_ICON_CHIP =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-stone-100 text-stone-700";

export function Card({
  title,
  description,
  children,
  className,
  icon: Icon,
  headingLevel = 2,
  actions,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
  /** Controls the heading level so page outline stays correct. */
  headingLevel?: 2 | 3 | 4;
  actions?: ReactNode;
}) {
  const Heading = `h${headingLevel}` as "h2" | "h3" | "h4";

  return (
    <section className={cn(CARD_SURFACE, "p-5", className)}>
      {title || description || Icon || actions ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            {Icon ? (
              <div className={CARD_ICON_CHIP}>
                <Icon className="h-4 w-4" aria-hidden="true" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">
              {title ? <Heading className="font-serif text-lg leading-snug text-stone-900">{title}</Heading> : null}
              {description ? (
                <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  );
}