import { Inbox } from "lucide-react";

export function EmptyState({
  title = "No records available.",
  description = "There is nothing to show here yet.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white text-stone-500 shadow-sm">
        <Inbox className="h-5 w-5" aria-hidden="true" />
      </div>
      <p className="mt-4 text-sm font-semibold text-stone-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}
