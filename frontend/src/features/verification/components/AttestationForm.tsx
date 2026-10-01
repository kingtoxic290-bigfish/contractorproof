import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { useAuth } from "../../../hooks/useAuth";
import { useAttestation } from "../hooks/useAttestation";
import { ATTEST_ROLES, type AttestationDecision, type PublicAttestation } from "../types";
import { ActionError } from "./ActionError";

function AttestationResult({ result }: { result: PublicAttestation }) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3" role="status">
      <p className="text-sm font-medium text-stone-900">Attestation recorded</p>
      <dl className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Decision</dt>
          <dd className="mt-1 text-sm font-medium text-stone-900">{result.decision}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Attestor role</dt>
          <dd className="mt-1 text-sm text-stone-900">{result.verifierRole}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-stone-500">Recorded at</dt>
          <dd className="mt-1 text-sm text-stone-900">{result.createdAt}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Attestation identifier</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">{result.id}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Evidence</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">{result.evidenceId}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs uppercase tracking-wide text-stone-500">Milestone</dt>
          <dd className="mt-1 break-all font-mono text-xs text-stone-900">{result.milestoneId}</dd>
        </div>
        {result.comment ? (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase tracking-wide text-stone-500">Comment</dt>
            <dd className="mt-1 text-sm text-stone-900">{result.comment}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-3 text-sm text-stone-600">
        {result.decision} is the attestation decision. It is separate from the fingerprint comparison result and does not directly update the evidence workflow status.
      </p>
    </div>
  );
}

export function AttestationForm({
  evidenceId,
  milestoneId,
}: {
  evidenceId?: string;
  milestoneId?: string;
}) {
  const { hasRole, user } = useAuth();
  const canAttest = hasRole(...ATTEST_ROLES);
  const { phase, error, result, attest, reset } = useAttestation();
  const [comment, setComment] = useState("");
  const [pending, setPending] = useState<AttestationDecision | null>(null);

  if (!canAttest) {
    return (
      <Card
        title="Attest evidence"
        description="CONTRACTOR accounts cannot record attestations, including for their own uploads."
      >
        <p className="text-sm text-stone-600">Attestation is not available for this role.</p>
      </Card>
    );
  }

  async function runAttest(decision: AttestationDecision) {
    if (pending !== decision) {
      setPending(decision);
      return;
    }
    await attest({
      evidenceId,
      milestoneId,
      decision,
      comment,
    });
    setPending(null);
  }

  return (
    <Card
      title="Attest evidence"
      description="Record an attestation decision for this evidence. An attestation is an authorized reviewer's decision — it is separate from the fingerprint comparison result."
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
        }}
      >
        <div
          className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-800"
          role="status"
          aria-live="polite"
          aria-label={`Attestation state: ${phase}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>{phase}</span>
        </div>

        {user ? (
          <p className="text-sm text-stone-700">
          Recording as: {user.fullName} · {user.role}
        </p>
        ) : null}

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-800">Optional comment</span>
          <textarea
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            rows={3}
            value={comment}
            onChange={(event) => {
              setComment(event.target.value);
              setPending(null);
            }}
          />
        </label>

        {pending ? (
          <p className="text-sm text-stone-800">
            Confirm recording a {pending} attestation for this evidence. This is not a fingerprint
            MATCH and does not prove the construction claim is true.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={phase === "submitting" || !evidenceId || !milestoneId}
            onClick={() => void runAttest("APPROVED")}
          >
            {pending === "APPROVED" ? "Confirm APPROVED attestation" : "Record APPROVED attestation"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={phase === "submitting" || !evidenceId || !milestoneId}
            onClick={() => void runAttest("REJECTED")}
          >
            {pending === "REJECTED" ? "Confirm REJECTED attestation" : "Record REJECTED attestation"}
          </Button>
          {pending ? (
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {phase === "submitting" ? <LoadingState message="Recording attestation..." /> : null}
        <ActionError
          phase={phase}
          error={error}
          onRetry={() => {
            reset();
          }}
        />
        {result ? <AttestationResult result={result} /> : null}
      </div>
    </Card>
  );
}
