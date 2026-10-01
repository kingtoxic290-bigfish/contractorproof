import { FormEvent, useEffect, useState } from "react";
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
  const rawProjectId = searchParams.get("projectId")?.trim() ?? "";
  const rawMilestoneId = searchParams.get("milestoneId")?.trim() ?? "";
  const projectId = optionalUuid(rawProjectId || null);
  const milestoneId = optionalUuid(rawMilestoneId || null);
  const queryFilterError =
    (rawProjectId && !projectId ? "Project identifier must be a valid UUID." : null) ??
    (rawMilestoneId && !milestoneId ? "Milestone identifier must be a valid UUID." : null);
  const [inputError, setInputError] = useState<string | null>(null);
  const filterError = inputError ?? queryFilterError;
  const { status, records, error, retry } = useEvidence(milestoneId, projectId, !filterError);
  const [projectInput, setProjectInput] = useState(rawProjectId);
  const [milestoneInput, setMilestoneInput] = useState(rawMilestoneId);

  useEffect(() => {
    setProjectInput(rawProjectId);
    setMilestoneInput(rawMilestoneId);
    setInputError(null);
  }, [rawMilestoneId, rawProjectId]);

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    const normalizedProjectId = projectInput.trim();
    const normalizedMilestoneId = milestoneInput.trim();
    if (normalizedProjectId && !isUuid(normalizedProjectId)) {
      setInputError("Project identifier must be a valid UUID.");
      return;
    }
    if (normalizedMilestoneId && !isUuid(normalizedMilestoneId)) {
      setInputError("Milestone identifier must be a valid UUID.");
      return;
    }
    if (normalizedProjectId) {
      next.set("projectId", normalizedProjectId);
    }
    if (normalizedMilestoneId) {
      next.set("milestoneId", normalizedMilestoneId);
    }
    setInputError(null);
    setSearchParams(next);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Evidence"
        description="Evidence records carry a SHA-256 fingerprint that proves file integrity. A matching fingerprint does not prove that the underlying construction claim is true."
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
        {filterError ? <p className="mt-3 text-sm text-red-700" role="alert">{filterError}</p> : null}
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

      {filterError ? null : (
        <QueryPanel
          status={status}
          error={error}
          onRetry={() => void retry()}
          loadingMessage="Loading evidence..."
          emptyTitle="No evidence uploaded yet."
          emptyDescription="No evidence records were found for this view."
        >
          <EvidenceList records={records} />
        </QueryPanel>
      )}
    </section>
  );
}
