import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ShieldCheck } from "lucide-react";

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
    <header className="mb-6 flex flex-col gap-3 border-b border-stone-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-stone-100 text-[#0f3d3a]">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.13em] text-stone-500">ContractorProof</p>
          <h1 className="mt-2 font-serif text-3xl tracking-tight text-stone-900">{title}</h1>
          {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </header>
  );
}
