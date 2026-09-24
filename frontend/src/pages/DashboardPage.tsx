import { useEffect, useState } from "react";
import { EmptyState } from "../components/feedback/EmptyState";
import { ErrorState } from "../components/feedback/ErrorState";
import { LoadingState } from "../components/feedback/LoadingState";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import { getHealth } from "../services/api/client";

type ConnectionState = "loading" | "available" | "unavailable";

export function DashboardPage() {
  const [connection, setConnection] = useState<ConnectionState>("loading");

  function checkConnection() {
    setConnection("loading");
    getHealth()
      .then(() => setConnection("available"))
      .catch(() => setConnection("unavailable"));
  }

  useEffect(() => {
    checkConnection();
  }, []);

  return (
    <section>
      <PageHeader
        title="Dashboard"
        description="Workspace for project evidence, authorized verification, and append-only event records. ContractorProof does not calculate a contractor trust score."
      />

      <div className="mb-6">
        {connection === "loading" ? (
          <LoadingState message="Checking the API connection..." />
        ) : null}
        {connection === "unavailable" ? (
          <ErrorState
            message="We couldn't reach the ContractorProof API. The workspace will still open, but records cannot be loaded yet."
            onRetry={checkConnection}
          />
        ) : null}
        {connection === "available" ? (
          <p className="text-sm text-stone-600">
            API connection: service reachable. Record lists are waiting for their backend modules.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Projects" description="Projects assigned to this account will appear here.">
          <EmptyState title="No projects available." description="The projects API is not connected to this screen yet." />
        </Card>
        <Card title="Pending actions" description="Attestations, disputes, or reviews that need attention.">
          <EmptyState title="No pending actions." description="Action queues will be populated from the backend." />
        </Card>
        <Card title="Verification activity" description="Authorized attestations and policy outcomes.">
          <EmptyState
            title="No verification activity."
            description="Verification results will not be invented in the interface."
          />
        </Card>
        <Card title="Recent evidence" description="Uploaded files and their SHA-256 fingerprints.">
          <EmptyState title="No evidence records." description="Evidence records will come from the evidence API." />
        </Card>
        <Card
          className="md:col-span-2"
          title="Recent events"
          description="Immutable verification, correction, dispute, and variation events."
        >
          <EmptyState
            title="No events available."
            description="Event history will appear after the backend records and returns them."
          />
        </Card>
      </div>
    </section>
  );
}
