import { FormEvent, useCallback, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { Field } from "../../../components/ui/Field";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { isUuid } from "../../verification/validation";
import { QueryPanel } from "../../shared/QueryPanel";
import { WorkflowStatusBadge } from "../../shared/WorkflowStatusBadge";
import { useAsyncResource } from "../../shared/useAsyncResource";
import {
  createCorrection,
  listCorrections,
  markCorrectionUnderReview,
  resolveCorrection,
} from "../api/correctionsApi";
import type { PublicCorrection } from "../types";

function optionalUuid(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isUuid(trimmed) ? trimmed : undefined;
}

/** Mirrors the backend CORRECTION_CREATE permission. */
const CREATE_ROLES = ["CONTRACTOR", "CLIENT", "CONSULTANT_ENGINEER", "ADMIN"] as const;
/** Mirrors the backend CORRECTION_RESOLVE permission. */
const RESOLVE_ROLES = ["ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"] as const;

function ProofSummary({ label, proof }: { label: string; proof: PublicCorrection["originalProof"] }) {
  return (
    <Field label={label}>
      {proof ? (
        <span>
          {proof.eventType} · {proof.confirmationState}
          {proof.blockNumber !== null ? ` · block ${proof.blockNumber}` : ""}
          {proof.txHash ? (
            <span className="mt-1 block break-all font-mono text-xs text-stone-700">
              {proof.txHash}
            </span>
          ) : (
            <span className="mt-1 block text-xs text-stone-600">
              No transaction hash recorded.
            </span>
          )}
        </span>
      ) : (
        <span className="text-stone-600">No blockchain proof recorded.</span>
      )}
    </Field>
  );
}

export function CorrectionsPage() {
  const [searchParams] = useSearchParams();
  const projectId = optionalUuid(searchParams.get("projectId"));
  const milestoneId = optionalUuid(searchParams.get("milestoneId"));
  const { hasRole } = useAuth();
  const canCreate = hasRole(...CREATE_ROLES);
  const canResolve = hasRole(...RESOLVE_ROLES);

  const loader = useCallback(
    () => listCorrections({ projectId, milestoneId }),
    [projectId, milestoneId],
  );
  const query = useAsyncResource(loader);
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  const [milestoneInput, setMilestoneInput] = useState(milestoneId ?? "");
  const [originalEventInput, setOriginalEventInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitCorrection(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!optionalUuid(milestoneInput)) {
      setFormError("A valid milestone identifier is required.");
      return;
    }
    if (!optionalUuid(originalEventInput)) {
      setFormError("A valid blockchain event identifier is required.");
      return;
    }
    if (!reasonInput.trim()) {
      setFormError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createCorrection({
        milestoneId: milestoneInput.trim(),
        originalEventId: originalEventInput.trim(),
        reason: reasonInput.trim(),
      });
      setNotice(`Correction requested. Status: ${created.status}.`);
      setReasonInput("");
      setOriginalEventInput("");
      await query.retry();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The correction could not be requested.");
    } finally {
      setSubmitting(false);
    }
  }

  async function act(correctionId: string, action: "review" | "resolve", statusValue?: "APPROVED" | "REJECTED") {
    setNotice(null);
    try {
      if (action === "review") {
        await markCorrectionUnderReview(correctionId);
        setNotice("Correction moved to UNDER_REVIEW.");
      } else {
        const resolution = window.prompt(
          statusValue === "APPROVED"
            ? "Record the approval reason for this correction:"
            : "Record the rejection reason for this correction:",
        );
        if (resolution === null) return;
        if (!resolution.trim()) {
          setNotice("A resolution reason is required.");
          return;
        }
        await resolveCorrection({
          correctionId,
          status: statusValue ?? "APPROVED",
          resolution: resolution.trim(),
        });
        setNotice(`Correction ${statusValue}.`);
      }
      await query.retry();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The action could not be completed.");
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Corrections"
        description="A correction appends a new event and leaves the original verification event unchanged. Corrections never alter technical verification history."
      />

      {projectId || milestoneId ? (
        <p className="text-sm text-stone-600">
          Filtered to{" "}
          {projectId ? <span className="font-mono">project {projectId}</span> : null}
          {projectId && milestoneId ? " and " : null}
          {milestoneId ? <span className="font-mono">milestone {milestoneId}</span> : null}
          . Only records you are authorized to read are returned.
        </p>
      ) : null}

      {canCreate ? (
        <Card
          title="Request a correction"
          description="Requests a change to submitted evidence. The original event stays on record."
        >
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitCorrection}>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-800">Milestone identifier</span>
              <input
                className="w-full rounded-md border border-stone-300 px-3 py-2"
                value={milestoneInput}
                onChange={(event) => setMilestoneInput(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-800">
                Blockchain event to correct
              </span>
              <input
                className="w-full rounded-md border border-stone-300 px-3 py-2"
                value={originalEventInput}
                onChange={(event) => setOriginalEventInput(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-stone-800">Reason</span>
              <textarea
                className="w-full rounded-md border border-stone-300 px-3 py-2"
                rows={2}
                value={reasonInput}
                onChange={(event) => setReasonInput(event.target.value)}
              />
            </label>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Requesting..." : "Request correction"}
              </Button>
            </div>
            {formError ? <p className="text-sm text-[#991b1b]">{formError}</p> : null}
            {notice ? <p className="text-sm text-stone-700">{notice}</p> : null}
          </form>
        </Card>
      ) : null}

      <QueryPanel
        status={status}
        error={query.error}
        onRetry={() => void query.retry()}
        loadingMessage="Loading corrections..."
        emptyTitle="No corrections are visible to you."
        emptyDescription="Corrections raised on projects you can access will appear here."
      >
        <ul className="grid gap-4">
          {records.map((record) => (
            <li key={record.id}>
              <Card
                title="Correction request"
                description={`Raised ${record.createdAt}`}
              >
                <div className="space-y-3">
                  <WorkflowStatusBadge status={record.status} />
                  <Field label="Reason">
                    <span className="block">{record.reason}</span>
                  </Field>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Field label="Milestone" mono>
                      {record.milestoneId}
                    </Field>
                    <Field label="Original blockchain event" mono>
                      {record.originalEventId}
                    </Field>
                    <Field label="Evidence" mono>
                      {record.evidenceId ?? "Not linked to a specific evidence record"}
                    </Field>
                    <Field label="Raised by" mono>
                      {record.actorId}
                    </Field>
                    <ProofSummary label="Original event proof" proof={record.originalProof} />
                    <ProofSummary label="Correction event proof" proof={record.blockchainProof} />
                  </dl>

                  {record.resolutions.length > 0 ? (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-sm font-medium text-stone-900">Review history</p>
                      <ul className="mt-2 space-y-2">
                        {record.resolutions.map((resolution) => (
                          <li key={resolution.id} className="text-sm text-stone-700">
                            <WorkflowStatusBadge status={resolution.status} className="mr-2" />
                            {resolution.resolution}
                            <span className="block text-xs text-stone-500">
                              {resolution.resolvedByRole} · {resolution.createdAt}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {canResolve ? (
                    <div className="flex flex-wrap gap-2">
                      {record.status === "OPEN" ? (
                        <Button onClick={() => void act(record.id, "review")}>Start review</Button>
                      ) : null}
                      {record.status === "OPEN" || record.status === "UNDER_REVIEW" ? (
                        <>
                          <Button onClick={() => void act(record.id, "resolve", "APPROVED")}>
                            Approve
                          </Button>
                          <Button onClick={() => void act(record.id, "resolve", "REJECTED")}>
                            Reject
                          </Button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </QueryPanel>
    </section>
  );
}