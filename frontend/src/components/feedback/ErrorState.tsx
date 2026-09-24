import { Button } from "../ui/Button";

export function ErrorState({
  message = "We couldn't load this information. Please try again.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-6">
      <p className="text-sm font-medium text-red-950">{message}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
