import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl tracking-tight text-stone-900">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{description}</p> : null}
      </div>
      {actions}
    </header>
  );
}
