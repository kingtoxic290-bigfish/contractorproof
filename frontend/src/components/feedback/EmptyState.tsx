export function EmptyState({
  title = "No records available.",
  description = "There is nothing to show here yet.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
      <p className="text-sm font-semibold text-stone-800">{title}</p>
      <p className="mt-2 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}
