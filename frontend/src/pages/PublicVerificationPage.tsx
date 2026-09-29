import { FormEvent, useState } from "react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import {
  createPublicVerification,
  publicVerificationErrorMessage,
  type PublicVerificationResult,
} from "../features/verification/api/publicVerificationApi";
import { PublicVerificationResultView } from "../features/verification/components/PublicVerificationResult";
import { validateVerificationTarget } from "../features/verification/validation";

export function PublicVerificationPage() {
  const [evidenceId, setEvidenceId] = useState("");
  const [evidenceVersionId, setEvidenceVersionId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<PublicVerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      setResult(
        await createPublicVerification({
          evidenceId: verifiedEvidenceId,
          evidenceVersionId: verifiedEvidenceVersionId,
          file,
        }),
      );
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
    <section className="space-y-5">
      <Card
        title="ContractorProof Verification"
        description="Check submitted evidence against the proof recorded by ContractorProof. No sign-in is required."
      >
        <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
          <p className="text-sm leading-6 text-stone-700">
            Supply the reference for the recorded evidence and the file you want to compare. The
            service performs the comparison; this page does not calculate or decide a result.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium text-stone-800">
              Evidence ID <span className="font-normal text-stone-500">(optional)</span>
              <input value={evidenceId} onChange={(event) => setEvidenceId(event.target.value)} className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900" aria-describedby="reference-help" />
            </label>
            <label className="block text-sm font-medium text-stone-800">
              Evidence version ID <span className="font-normal text-stone-500">(optional)</span>
              <input value={evidenceVersionId} onChange={(event) => setEvidenceVersionId(event.target.value)} className="mt-1.5 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900" aria-describedby="reference-help" />
            </label>
          </div>
          <p id="reference-help" className="-mt-2 text-xs leading-5 text-stone-600">Enter at least one UUID reference. If both are supplied, they must refer to the same evidence version.</p>
          <label className="block text-sm font-medium text-stone-800">
            Evidence file <span className="text-red-800">(required)</span>
            <input type="file" required onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="mt-1.5 block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm font-normal text-stone-900" />
          </label>
          {file ? <p className="-mt-3 text-xs text-stone-600">Selected file: {file.name}</p> : null}
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">{error}</p> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" disabled={submitting}>{submitting ? "Verifying evidence…" : "Verify evidence"}</Button>
            {(result || error || evidenceId || evidenceVersionId || file) ? <Button type="button" variant="secondary" disabled={submitting} onClick={reset}>New verification</Button> : null}
          </div>
        </form>
      </Card>
      {submitting ? <p className="text-sm font-medium text-stone-700" role="status">Verifying submitted evidence…</p> : null}
      {result ? <PublicVerificationResultView result={result} /> : null}
    </section>
  );
}
