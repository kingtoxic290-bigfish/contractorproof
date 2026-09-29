import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({
  title,
  description,
  children,
  className,
  icon: Icon,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  icon?: LucideIcon;
}) {
  return (
    <section className={cn("rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", className)}>
      {(title || description || Icon) ? (
        <div className="mb-4 flex items-start gap-3">
          {Icon ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-stone-700">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            {title ? <h2 className="font-serif text-xl leading-tight text-stone-900">{title}</h2> : null}
            {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
          </div>
        </div>
      ) : null}
      <div>{children}</div>
    </section>
  );
}
