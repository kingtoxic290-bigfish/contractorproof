import { FormEvent, useRef, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { PageHeader } from "../components/ui/PageHeader";
import {
  createPublicVerification,
  publicVerificationErrorMessage,
  type PublicVerificationResult,
} from "../features/verification/api/publicVerificationApi";
import { PublicVerificationResultView } from "../features/verification/components/PublicVerificationResult";
import { validateVerificationTarget } from "../features/verification/validation";

const FIELD_CLASSES =
  "mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]";

/** The four steps a request moves through, shown so the workflow is obvious. */
const STEPS = [
  "Submit the evidence reference and file",
  "The service performs the comparison",
  "A factual result is returned",
  "Blockchain proof is shown only if confirmed",
];

export function PublicVerificationPage() {
  const [evidenceId, setEvidenceId] = useState("");
  const [evidenceVersionId, setEvidenceVersionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PublicVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const resultHeadingRef = useRef<HTMLDivElement>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);
    const target = validateVerificationTarget({ evidenceId, evidenceVersionId });
    if (!target.ok) {
      setError(
        target.reason === "missing_target"
          ? "Enter an evidence ID or evidence version ID."
          : "Evidence IDs must be valid UUIDs.",
      );
      return;
    }
    if (!file || file.size === 0) {
      setError("Choose a non-empty evidence file to verify.");
      return;
    }

    const { evidenceId: verifiedEvidenceId, evidenceVersionId: verifiedEvidenceVersionId } = target;
    setSubmitting(true);
    try {
      const outcome = await createPublicVerification({
        evidenceId: verifiedEvidenceId,
        evidenceVersionId: verifiedEvidenceVersionId,
        file,
      });
      setResult(outcome);
      resultHeadingRef.current?.focus();
    } catch (requestError) {
      setError(publicVerificationErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setEvidenceId("");
    setEvidenceVersionId("");
    setFile(null);
    setResult(null);
    setError(null);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Public verification"
        description="Check a file against evidence recorded by ContractorProof. This service is open and requires no account."
      />

      <Card title="How this works">
        <ol className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step, index) => (
            <li key={step} className="flex items-start gap-3 text-sm text-stone-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-stone-300 bg-stone-50 text-xs font-semibold tabular-nums text-stone-700">
                {index + 1}
              </span>
              <span className="min-w-0 leading-6">{step}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card
        title="ContractorProof Verification"
        description="Supply the reference for the recorded evidence and the file you want to compare."
      >
        <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
          <p className="text-sm leading-6 text-stone-700">
            The service performs the comparison and returns its result. This page does not calculate
            or decide a result of its own.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-stone-800">
              Evidence ID <span className="font-normal text-stone-500">(optional)</span>
              <input
                value={evidenceId}
                onChange={(event) => setEvidenceId(event.target.value)}
                className={FIELD_CLASSES}
                aria-describedby="reference-help"
                autoComplete="off"
              />
            </label>
            <label className="block text-sm font-medium text-stone-800">
              Evidence version ID <span className="font-normal text-stone-500">(optional)</span>
              <input
                value={evidenceVersionId}
                onChange={(event) => setEvidenceVersionId(event.target.value)}
                className={FIELD_CLASSES}
                aria-describedby="reference-help"
                autoComplete="off"
              />
            </label>
          </div>
          <p id="reference-help" className="-mt-2 text-xs leading-5 text-stone-600">
            Enter at least one UUID reference. If both are supplied, they must refer to the same
            evidence version.
          </p>
          <label className="block text-sm font-medium text-stone-800">
            Evidence file <span className="text-red-800">(required)</span>
            <input
              type="file"
              required
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
            />
          </label>
          {file ? (
            <p className="-mt-3 text-xs text-stone-600">
              Selected file: <span className="font-medium text-stone-800">{file.name}</span>
            </p>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting ? "Verifying evidence…" : "Verify evidence"}
            </Button>
            {result || error || evidenceId || evidenceVersionId || file ? (
              <Button type="button" variant="secondary" disabled={submitting} onClick={reset}>
                New verification
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      {submitting ? (
        <p className="text-sm font-medium text-stone-700" role="status" aria-live="polite">
          Comparing the submitted file with the recorded evidence fingerprint…
        </p>
      ) : null}

      {result ? (
        <div ref={resultHeadingRef} tabIndex={-1} className="focus:outline-none">
          <PublicVerificationResultView result={result} />
        </div>
      ) : null}
    </section>
  );
}