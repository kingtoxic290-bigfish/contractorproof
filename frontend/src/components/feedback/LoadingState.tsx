import { LoaderCircle } from "lucide-react";

/**
 * Standard loading state.
 *
 * Uses `role="status"` with a polite live region so assistive technology is told
 * that content is arriving, and avoids a blank screen while data is fetched.
 */
export function LoadingState({
  message = "Loading records...",
  hint,
}: {
  message?: string;
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-stone-200 bg-white px-4 py-8 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#0f3d3a]/5 text-[#0f3d3a]">
        <LoaderCircle className="h-5 w-5 animate-spin" aria-hidden="true" />
      </div>
      <p className="text-sm font-semibold text-stone-800">{message}</p>
      {hint ? <p className="mt-1 text-sm text-stone-600">{hint}</p> : null}
    </div>
  );
}