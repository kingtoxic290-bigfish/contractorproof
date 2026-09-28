import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Section({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-stone-200 bg-white p-5 shadow-sm", className)}>
      {(title || description || actions) ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title ? <h2 className="font-serif text-xl leading-tight text-stone-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}
