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
import type { WorkflowProof } from "../../shared/blockchainProof";
import {
  createDispute,
  listDisputes,
  markDisputeUnderReview,
  resolveDispute,
} from "../api/disputesApi";
import type { PublicDispute } from "../types";

function optionalUuid(value: string | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed && isUuid(trimmed) ? trimmed : undefined;
}

/** Mirrors the backend DISPUTE_CREATE permission. */
const CREATE_ROLES = ["CONTRACTOR", "CLIENT", "CONSULTANT_ENGINEER", "ADMIN"] as const;
/** Mirrors the backend DISPUTE_RESOLVE permission. */
const RESOLVE_ROLES = ["ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"] as const;

function ProofSummary({ label, proof }: { label: string; proof: WorkflowProof | null }) {
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
            <span className="mt-1 block text-xs text-stone-600">No transaction hash recorded.</span>
          )}
        </span>
      ) : (
        <span className="text-stone-600">No blockchain proof recorded.</span>
      )}
    </Field>
  );
}

export function DisputesPage() {
  const [searchParams] = useSearchParams();
  const projectId = optionalUuid(searchParams.get("projectId"));
  const milestoneId = optionalUuid(searchParams.get("milestoneId"));
  const { hasRole } = useAuth();
  const canCreate = hasRole(...CREATE_ROLES);
  const canResolve = hasRole(...RESOLVE_ROLES);

  const loader = useCallback(
    () => listDisputes({ projectId, milestoneId }),
    [projectId, milestoneId],
  );
  const query = useAsyncResource(loader);
  const records = query.data ?? [];
  const status = query.status === "success" && records.length === 0 ? "empty" : query.status;

  const [milestoneInput, setMilestoneInput] = useState(milestoneId ?? "");
  const [evidenceInput, setEvidenceInput] = useState("");
  const [originalEventInput, setOriginalEventInput] = useState("");
  const [reasonInput, setReasonInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function submitDispute(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!optionalUuid(milestoneInput)) {
      setFormError("A valid milestone identifier is required.");
      return;
    }
    if (evidenceInput.trim() && !optionalUuid(evidenceInput)) {
      setFormError("The evidence identifier must be a valid UUID.");
      return;
    }
    if (!reasonInput.trim()) {
      setFormError("A reason is required.");
      return;
    }
    setSubmitting(true);
    try {
      const created = await createDispute({
        milestoneId: milestoneInput.trim(),
        reason: reasonInput.trim(),
        ...(optionalUuid(evidenceInput) ? { evidenceId: evidenceInput.trim() } : {}),
        ...(optionalUuid(originalEventInput)
          ? { originalEventId: originalEventInput.trim() }
          : {}),
      });
      setNotice(`Dispute raised. Status: ${created.status}.`);
      setReasonInput("");
      await query.retry();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The dispute could not be raised.");
    } finally {
      setSubmitting(false);
    }
  }

  async function act(disputeId: string, action: "review" | "resolve", statusValue?: "RESOLVED" | "REJECTED") {
    setNotice(null);
    try {
      if (action === "review") {
        await markDisputeUnderReview(disputeId);
        setNotice("Dispute moved to UNDER_REVIEW.");
      } else {
        const resolution = window.prompt(
          statusValue === "RESOLVED"
            ? "Record how this dispute was resolved:"
            : "Record why this dispute was rejected:",
        );
        if (resolution === null) return;
        if (!resolution.trim()) {
          setNotice("A resolution reason is required.");
          return;
        }
        await resolveDispute({
          disputeId,
          status: statusValue ?? "RESOLVED",
          resolution: resolution.trim(),
        });
        setNotice(`Dispute ${statusValue}.`);
      }
      await query.retry();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "The action could not be completed.");
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Disputes"
        description="A dispute records disagreement with submitted evidence or its verification. It is recorded as its own event and never changes technical verification or blockchain proof."
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
          title="Raise a dispute"
          description="Records a formal disagreement for resolution by authorized personnel."
        >
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={submitDispute}>
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
                Evidence identifier (optional)
              </span>
              <input
                className="w-full rounded-md border border-stone-300 px-3 py-2"
                value={evidenceInput}
                onChange={(event) => setEvidenceInput(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-stone-800">
                Blockchain event identifier (optional)
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
                {submitting ? "Raising..." : "Raise dispute"}
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
        loadingMessage="Loading disputes..."
        emptyTitle="No disputes are visible to you."
        emptyDescription="Disputes raised on projects you can access will appear here."
      >
        <ul className="grid gap-4">
          {records.map((record: PublicDispute) => (
            <li key={record.id}>
              <Card title="Dispute" description={`Raised ${record.createdAt}`}>
                <div className="space-y-3">
                  <WorkflowStatusBadge status={record.status} />
                  <Field label="Reason">
                    <span className="block">{record.reason}</span>
                  </Field>
                  <dl className="grid gap-3 sm:grid-cols-2">
                    <Field label="Milestone" mono>
                      {record.milestoneId}
                    </Field>
                    <Field label="Evidence" mono>
                      {record.evidenceId ?? "Not linked to a specific evidence record"}
                    </Field>
                    <Field label="Raised by" mono>
                      {record.raisedById}
                    </Field>
                    <Field label="Last updated">{record.updatedAt}</Field>
                    <ProofSummary label="Original event proof" proof={record.originalProof} />
                    <ProofSummary label="Dispute event proof" proof={record.blockchainProof} />
                    <ProofSummary label="Resolution event proof" proof={record.resolutionProof} />
                  </dl>

                  {record.resolutions.length > 0 ? (
                    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-sm font-medium text-stone-900">Resolution history</p>
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
                          <Button onClick={() => void act(record.id, "resolve", "RESOLVED")}>
                            Resolve
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