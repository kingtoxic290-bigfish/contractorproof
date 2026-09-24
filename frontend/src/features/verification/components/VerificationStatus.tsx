import { cn } from "../../../utils/cn";
import { isVerificationStatus } from "../types";

const STATUS_CLASS: Record<string, string> = {
  MATCH: "border-teal-700 bg-teal-50 text-teal-950",
  MISMATCH: "border-amber-600 bg-amber-50 text-amber-950",
  PENDING: "border-stone-400 bg-stone-50 text-stone-800",
  UNAVAILABLE: "border-slate-500 bg-slate-50 text-slate-900",
};

export function VerificationStatus({ status }: { status: string }) {
  const tone = isVerificationStatus(status) ? STATUS_CLASS[status] : "border-stone-300 bg-white text-stone-800";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone,
      )}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{status}</span>
    </span>
  );
}
