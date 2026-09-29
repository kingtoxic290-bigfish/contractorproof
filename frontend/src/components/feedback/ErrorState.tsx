import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";

export function ErrorState({
  message = "We couldn't load this information. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 px-4 py-6 shadow-[0_1px_2px_rgba(153,27,27,0.06)]">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-red-950">{message}</p>
        </div>
      </div>
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
