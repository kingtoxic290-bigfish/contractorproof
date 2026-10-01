import { AlertTriangle } from "lucide-react";
import { Button } from "../ui/Button";

/**
 * Standard error state.
 *
 * `role="alert"` announces the failure. Only a factual, user-facing message is
 * shown: no stack traces, raw payloads or internal server detail.
 */
export function ErrorState({
  message = "We couldn't load this information. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-red-200 bg-red-50 px-4 py-5"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-700">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-red-950">{message}</p>
          {onRetry ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={onRetry}
            >
              Try again
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}