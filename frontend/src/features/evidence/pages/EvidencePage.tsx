import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { EvidenceList } from "../components/EvidenceList";
import { EvidenceUpload } from "../components/EvidenceUpload";
import { useEvidence } from "../hooks/useEvidence";
import { isUuid } from "../validation";

function optionalUuid(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isUuid(trimmed) ? trimmed : undefined;
}

export function EvidencePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = optionalUuid(searchParams.get("projectId"));
  const milestoneId = optionalUuid(searchParams.get("milestoneId"));
  const { status, records, error, retry } = useEvidence(milestoneId, projectId);
  const [projectInput, setProjectInput] = useState(projectId ?? "");
  const [milestoneInput, setMilestoneInput] = useState(milestoneId ?? "");

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (optionalUuid(projectInput)) {
      next.set("projectId", projectInput.trim());
    }
    if (optionalUuid(milestoneInput)) {
      next.set("milestoneId", milestoneInput.trim());
    }
    setSearchParams(next);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Evidence"
        description="Evidence files are listed from GET /api/v1/evidence. A SHA-256 fingerprint proves file integrity, not that the underlying construction claim is true."
      />

      <Card title="Filter evidence" description="Optional project or milestone identifiers must be UUIDs. Inaccessible filters return an empty list.">
        <form className="grid gap-3 sm:grid-cols-2" onSubmit={applyFilters}>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-800">Project identifier</span>
            <input
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              value={projectInput}
              onChange={(event) => setProjectInput(event.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-800">Milestone identifier</span>
            <input
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              value={milestoneInput}
              onChange={(event) => setMilestoneInput(event.target.value)}
              autoComplete="off"
            />
          </label>
          <div className="sm:col-span-2">
            <Button type="submit">Apply filters</Button>
          </div>
        </form>
        <p className="mt-3 text-sm text-stone-600">
          Open evidence from a{" "}
          <Link
            className="font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            to="/projects"
          >
            project
          </Link>{" "}
          or{" "}
          <Link
            className="font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            to="/milestones"
          >
            milestone
          </Link>
          .
        </p>
      </Card>

      <EvidenceUpload
        initialMilestoneId={milestoneId}
        initialProjectId={projectId}
        onUploaded={() => void retry()}
      />

      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading evidence..."
        emptyTitle="No evidence uploaded yet."
        emptyDescription="The API returned no evidence records for this view."
      >
        <EvidenceList records={records} />
      </QueryPanel>
    </section>
  );
}
