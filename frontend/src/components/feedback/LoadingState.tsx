export function LoadingState({
  message = "Loading project information...",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-lg border border-dashed border-stone-300 bg-white px-4 py-8 text-center"
    >
      <p className="text-sm font-medium text-stone-800">{message}</p>
      <p className="mt-1 text-sm text-stone-500">Please wait.</p>
    </div>
  );
}
