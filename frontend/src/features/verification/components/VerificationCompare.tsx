import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { useAuth } from "../../../hooks/useAuth";
import { useVerification } from "../hooks/useVerification";
import { VERIFY_INTERNAL_ROLES } from "../types";
import { ActionError } from "./ActionError";
import { VerificationResult } from "./VerificationResult";

type PendingCompare = "stored" | "presented" | null;

export function VerificationCompare({
  evidenceId,
  evidenceVersionId,
}: {
  evidenceId?: string;
  evidenceVersionId?: string;
}) {
  const { hasRole } = useAuth();
  const canVerify = hasRole(...VERIFY_INTERNAL_ROLES);
  const { phase, error, result, compare, reset } = useVerification();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<PendingCompare>(null);

  if (!canVerify) {
    return (
      <Card
        title="Compare fingerprints"
        description="CONTRACTOR accounts cannot verify evidence, including their own uploads. The API remains authoritative."
      >
        <p className="text-sm text-stone-600">Fingerprint comparison is not available for this role.</p>
      </Card>
    );
  }

  async function runCompare(mode: Exclude<PendingCompare, null>) {
    if (pending !== mode) {
      setPending(mode);
      return;
    }
    await compare({
      evidenceId,
      evidenceVersionId,
      file: mode === "presented" ? file ?? undefined : undefined,
    });
    setPending(null);
  }

  return (
    <Card
      title="Compare fingerprints"
      description="POST /api/v1/verification compares presented or stored bytes to EvidenceVersion.sha256. MATCH is not VERIFIED and is not an attestation."
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
          aria-label={`Comparison state: ${phase}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>{phase}</span>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-800">Optional presented file</span>
          <input
            type="file"
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPending(null);
              reset();
            }}
          />
        </label>
        <p className="text-sm text-stone-600">
          Without a file, the server re-hashes the stored bytes. With a file, those bytes are
          compared to the recorded fingerprint.
        </p>

        {pending === "stored" ? (
          <p className="text-sm text-stone-800">
            Confirm compare of the stored evidence bytes to the recorded SHA-256 fingerprint. This
            does not mark the construction claim as true.
          </p>
        ) : null}
        {pending === "presented" ? (
          <p className="text-sm text-stone-800">
            Confirm compare of the selected file to the recorded SHA-256 fingerprint. This does not
            mark the construction claim as true.
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={phase === "submitting" || (!evidenceId && !evidenceVersionId)}
            onClick={() => void runCompare("stored")}
          >
            {pending === "stored" ? "Confirm stored comparison" : "Compare stored fingerprint"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={phase === "submitting" || !file || (!evidenceId && !evidenceVersionId)}
            onClick={() => void runCompare("presented")}
          >
            {pending === "presented" ? "Confirm presented-file comparison" : "Compare presented file"}
          </Button>
          {pending ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setPending(null)}
            >
              Cancel
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {phase === "submitting" ? <LoadingState message="Recording fingerprint comparison..." /> : null}
        <ActionError
          phase={phase}
          error={error}
          onRetry={() => {
            reset();
          }}
        />
        {result ? <VerificationResult result={result} /> : null}
      </div>
    </Card>
  );
}
