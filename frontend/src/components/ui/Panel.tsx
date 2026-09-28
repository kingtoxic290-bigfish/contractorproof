import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Panel({
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
    <div className={cn("rounded-xl border border-stone-200 bg-white p-5 shadow-sm", className)}>
      {title ? <h3 className="font-serif text-lg text-stone-900">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm text-stone-600">{description}</p> : null}
      <div className={title || description ? "mt-4" : undefined}>{children}</div>
    </div>
  );
}
