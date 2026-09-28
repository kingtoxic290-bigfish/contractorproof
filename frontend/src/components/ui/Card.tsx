import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({
  title,
  description,
  children,
  className,
}: {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border border-stone-200 bg-white p-5 shadow-sm", className)}>
      {title ? <h2 className="font-serif text-xl leading-tight text-stone-900">{title}</h2> : null}
      {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </section>
  );
}
