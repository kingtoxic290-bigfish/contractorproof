import type { ReactNode } from "react";
import { EmptyState } from "../../components/feedback/EmptyState";
import { ErrorState } from "../../components/feedback/ErrorState";
import { LoadingState } from "../../components/feedback/LoadingState";
import type { QueryStatus } from "./query";
import { UnavailableState } from "./UnavailableState";

export function QueryPanel({
  status,
  error,
  onRetry,
  loadingMessage,
  emptyTitle,
  emptyDescription,
  children,
}: {
  status: QueryStatus;
  error?: string | null;
  onRetry?: () => void;
  loadingMessage?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
}) {
  if (status === "idle") {
    return null;
  }
  if (status === "loading") {
    return <LoadingState message={loadingMessage} />;
  }
  if (status === "unavailable") {
    return (
      <UnavailableState
        message={error ?? "This information is not available from the API yet."}
        onRetry={onRetry}
      />
    );
  }
  if (status === "forbidden") {
    return <ErrorState message={error ?? "You do not have permission to view this information."} />;
  }
  if (status === "unauthorized") {
    return <ErrorState message={error ?? "You need to sign in to view this information."} />;
  }
  if (status === "notfound") {
    return (
      <EmptyState
        title="The requested record was not found."
        description="The API did not return this resource."
      />
    );
  }
  if (status === "error") {
    return (
      <ErrorState
        message={error ?? "We couldn't load this information. Please try again."}
        onRetry={onRetry}
      />
    );
  }
  if (status === "empty") {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }
  return children;
}
