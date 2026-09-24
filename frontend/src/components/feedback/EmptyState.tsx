export function EmptyState({
  title = "No projects available.",
  description = "There is nothing to show here yet.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
      <p className="text-sm font-medium text-stone-800">{title}</p>
      <p className="mt-1 text-sm text-stone-600">{description}</p>
    </div>
  );
}
