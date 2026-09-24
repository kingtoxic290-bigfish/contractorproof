import { Button } from "../../components/ui/Button";

export function UnavailableState({
  message = "This information is not available from the API yet.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div role="status" className="rounded-lg border border-stone-300 bg-stone-50 px-4 py-6">
      <p className="text-sm font-medium text-stone-900">{message}</p>
      <p className="mt-1 text-sm text-stone-600">
        The server reported that this resource is not implemented. No records are shown.
      </p>
      {onRetry ? (
        <Button type="button" variant="secondary" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
