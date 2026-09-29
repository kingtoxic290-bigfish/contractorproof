import { LoaderCircle } from "lucide-react";

export function LoadingState({
  message = "Loading project information...",
}: {
  message?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-stone-200 bg-white px-4 py-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0f3d3a]/5 text-[#0f3d3a]">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-stone-800">{message}</p>
      <p className="mt-1 text-sm text-stone-500">Please wait.</p>
    </div>
  );
}
