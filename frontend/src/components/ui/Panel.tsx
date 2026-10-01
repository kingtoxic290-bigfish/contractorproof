import type { ReactNode } from "react";
import { cn } from "../../utils/cn";
import { CARD_SURFACE } from "./Card";

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
    <div className={cn(CARD_SURFACE, "p-4", className)}>
      {title ? <h3 className="font-serif text-base leading-snug text-stone-900">{title}</h3> : null}
      {description ? <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p> : null}
      <div className={title || description ? "mt-3" : undefined}>{children}</div>
    </div>
  );
}