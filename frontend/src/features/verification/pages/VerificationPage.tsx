import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import type { PublicEvidence } from "../../evidence/types";
import { QueryPanel } from "../../shared/QueryPanel";
import { AttestationForm } from "../components/AttestationForm";
import { EvidenceReview } from "../components/EvidenceReview";
import { HumanReview } from "../components/HumanReview";
import { VerificationCompare } from "../components/VerificationCompare";
import { VerificationHistory } from "../components/VerificationHistory";
import { isUuid } from "../validation";

function optionalUuid(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isUuid(trimmed) ? trimmed : undefined;
}

function reviewPath(record: PublicEvidence, projectId?: string): string {
  const params = new URLSearchParams();
  params.set("evidenceId", record.id);
  params.set("milestoneId", record.milestoneId);
  if (projectId) {
    params.set("projectId", projectId);
  }
  if (record.currentVersionId) {
    params.set("evidenceVersionId", record.currentVersionId);
  }
  return `/verification?${params.toString()}`;
}

export function VerificationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectId = optionalUuid(searchParams.get("projectId"));
  const milestoneId = optionalUuid(searchParams.get("milestoneId"));
  const evidenceId = optionalUuid(searchParams.get("evidenceId"));
  const evidenceVersionId = optionalUuid(searchParams.get("evidenceVersionId"));
  const { status, records, error, retry } = useEvidence(milestoneId, projectId);
  const [projectInput, setProjectInput] = useState(projectId ?? "");
  const [milestoneInput, setMilestoneInput] = useState(milestoneId ?? "");

  const selected =
    evidenceId != null ? (records.find((record) => record.id === evidenceId) ?? null) : null;
  const selectedVersionId = selected?.currentVersionId ?? evidenceVersionId;
  const selectedMilestoneId = selected?.milestoneId ?? milestoneId;

  function applyFilters(event: FormEvent) {
    event.preventDefault();
    const next = new URLSearchParams();
    if (optionalUuid(projectInput)) {
      next.set("projectId", projectInput.trim());
    }
    if (optionalUuid(milestoneInput)) {
      next.set("milestoneId", milestoneInput.trim());
    }
    if (evidenceId) {
      next.set("evidenceId", evidenceId);
    }
    if (evidenceVersionId) {
      next.set("evidenceVersionId", evidenceVersionId);
    }
    setSearchParams(next);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Verification"
        description="Review submitted evidence, inspect the system-controlled technical result, and record an attestation where your role and project policy permit."
      />

      <Card
        title="1. Submitted evidence"
        description="Filter by project or milestone to find the evidence record you want to verify. Select a record to load its fingerprint comparison and attestation panels."
      >
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
          Open evidence from the{" "}
          <Link
            className="font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            to="/evidence"
          >
            evidence
          </Link>{" "}
          page, or navigate here from a project or milestone.
        </p>
      </Card>

      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading evidence for review..."
        emptyTitle="No evidence is currently available to review."
        emptyDescription="No evidence records were returned for the current filter. Adjust the project or milestone filter, or open evidence from the evidence page."
      >
        <ul className="grid gap-3">
          {records.map((record) => {
            const active = record.id === evidenceId;
            return (
              <li key={record.id}>
                <Link
                  to={reviewPath(record, projectId)}
                  className={`block rounded-md border px-3 py-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800 ${
                    active ? "border-teal-800 bg-teal-50" : "border-stone-200 bg-white hover:bg-stone-50"
                  }`}
                >
                  <p className="text-sm font-medium text-stone-900">{record.fileName}</p>
                  <p className="mt-1 text-sm text-stone-600">
                    Workflow {record.status} · Fingerprint compare {record.verificationStatus}
                  </p>
                  <p className="mt-1 break-all font-mono text-xs text-stone-700">{record.sha256}</p>
                </Link>
              </li>
            );
          })}
        </ul>
      </QueryPanel>

      <EvidenceReview
        evidence={selected}
        evidenceId={evidenceId}
        evidenceVersionId={selectedVersionId}
        milestoneId={selectedMilestoneId}
        projectId={projectId}
      />

      <section aria-label="Technical verification" className="space-y-6">
        <h2 className="font-serif text-xl text-stone-900">2. Technical verification</h2>
        <p className="text-sm text-stone-600">
          Results are system-controlled and immutable to users. Only authorized internal reviewers can request a new technical comparison.
        </p>
        <VerificationHistory evidenceId={evidenceId} evidenceVersionId={selectedVersionId} />
        <VerificationCompare evidenceId={evidenceId} evidenceVersionId={selectedVersionId} />
      </section>

      <section aria-label="Human review" className="space-y-6">
        <h2 className="font-serif text-xl text-stone-900">3. Human review</h2>
        <p className="text-sm text-stone-600">
          Human review is separate from technical verification. Correction and dispute records use their own authorized workflows.
        </p>
        <HumanReview
          evidenceId={evidenceId}
          milestoneId={selectedMilestoneId}
          projectId={projectId}
        />
      </section>

      <section aria-label="Attestation" className="space-y-6">
        <h2 className="font-serif text-xl text-stone-900">4. Attestation</h2>
        <p className="text-sm text-stone-600">
          An explicit decision recorded separately from the technical comparison. Available only where the backend role and project policy permit it.
        </p>
        <AttestationForm evidenceId={evidenceId} milestoneId={selectedMilestoneId} />
      </section>
    </section>
  );
}
