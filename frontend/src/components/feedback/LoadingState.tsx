export function LoadingState({
  message = "Loading project information...",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center shadow-sm"
    >
      <div className="mx-auto mb-3 h-4 w-4 animate-pulse rounded-full bg-[#0f3d3a]" aria-hidden="true" />
      <p className="text-sm font-semibold text-stone-800">{message}</p>
      <p className="mt-1 text-sm text-stone-500">Please wait.</p>
    </div>
  );
}
