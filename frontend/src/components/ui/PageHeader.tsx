import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

/**
 * Standard page header: one `h1`, a concise factual description, and the
 * page's primary action. Every authenticated and public page uses this so the
 * top of the screen is consistent across the product.
 */
export function PageHeader({
  title,
  description,
  actions,
  icon: Icon = ShieldCheck,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <header className="mb-5 flex flex-col gap-4 border-b border-stone-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#0f3d3a]/15 bg-[#0f3d3a]/5 text-[#0f3d3a]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
            ContractorProof
          </p>
          <h1 className="mt-1.5 font-serif text-2xl leading-tight text-stone-900 sm:text-3xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}