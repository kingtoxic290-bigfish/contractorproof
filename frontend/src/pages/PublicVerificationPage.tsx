import { Link } from "react-router-dom";
import { EmptyState } from "../components/feedback/EmptyState";
import { Card } from "../components/ui/Card";
import { StatusBadge } from "../components/ui/StatusBadge";

export function PublicVerificationPage() {
  return (
    <section className="space-y-4">
      <Card
        title="Public evidence verification"
        description="Compare a file against a recorded evidence fingerprint. This check is not implemented in Stage 1."
      >
        <div className="space-y-3 text-sm leading-6 text-stone-700">
          <p>
            A later release will let anyone submit a file, calculate SHA-256, and compare it to the
            stored fingerprint.
          </p>
          <p>
            <StatusBadge status="MATCH" /> means the submitted file matches the recorded evidence
            fingerprint.
          </p>
          <p>
            <StatusBadge status="MISMATCH" /> means the file does not match the recorded fingerprint.
          </p>
          <p>
            MATCH does not mean that blockchain independently proves the underlying construction
            claim is true. Blockchain proves integrity of the recorded evidence or event.
          </p>
        </div>
      </Card>
      <EmptyState
        title="This module is under development."
        description="No file is being hashed and no MATCH or MISMATCH result is being calculated on this page."
      />
      <p className="text-sm text-stone-600">
        Authorized users can <Link className="font-medium text-teal-900 underline underline-offset-2" to="/login">sign in</Link> to
        the workspace.
      </p>
    </section>
  );
}
