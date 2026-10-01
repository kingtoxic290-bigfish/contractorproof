import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { useAuth } from "../../../hooks/useAuth";
import { AlertTriangle, FileQuestion, Gavel, ExternalLink } from "lucide-react";

export function HumanReview({
  evidenceId,
  milestoneId,
  projectId,
}: {
  evidenceId?: string;
  milestoneId?: string;
  projectId?: string;
}) {
  const { hasRole } = useAuth();
  // Mirrors the backend DISPUTE_CREATE / CORRECTION_CREATE permissions. A role
  // that the backend accepts is not hidden here, but the backend remains
  // authoritative: it can still reject a request for an unrelated project.
  const canReview = hasRole("CLIENT", "CONTRACTOR", "CONSULTANT_ENGINEER", "ADMIN");

  if (!canReview) {
    return (
      <Card
        title="Human review"
        description="Human review actions are available to the project client and authorized roles."
      >
        <p className="text-sm text-stone-600">Human review is not available for this role.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Human review"
      description="Record your review decision. This is separate from technical fingerprint verification."
    >
      <div className="space-y-4">
        <div
          className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900"
          role="status"
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Human review decision</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2 p-4 rounded-xl border border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2">
              <FileQuestion className="h-5 w-5 text-stone-600" aria-hidden="true" />
              <h4 className="font-medium text-stone-900">Request correction</h4>
            </div>
            <p className="text-sm text-stone-600">
              The evidence needs changes before it can be accepted. A correction references a specific
              blockchain event (e.g., a verification result) and asks the contractor to provide corrected evidence.
            </p>
            <p className="text-xs text-stone-500">
              Requires: milestone ID, blockchain event ID to correct, reason, and optional evidence ID.
            </p>
            {projectId && (
              <Link
                to={`/corrections?projectId=${encodeURIComponent(projectId)}${milestoneId ? `&milestoneId=${encodeURIComponent(milestoneId)}` : ""}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open corrections page
              </Link>
            )}
          </div>

          <div className="space-y-2 p-4 rounded-xl border border-stone-200 bg-stone-50">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-stone-600" aria-hidden="true" />
              <h4 className="font-medium text-stone-900">Raise dispute</h4>
            </div>
            <p className="text-sm text-stone-600">
              You disagree with the evidence or its verification. A dispute references a specific
              blockchain event and is recorded for resolution by authorized personnel.
            </p>
            <p className="text-xs text-stone-500">
              Requires: milestone ID, reason, optional evidence ID, and optional blockchain event ID.
            </p>
            {projectId && (
              <Link
                to={`/disputes?projectId=${encodeURIComponent(projectId)}${milestoneId ? `&milestoneId=${encodeURIComponent(milestoneId)}` : ""}`}
                className="inline-flex items-center gap-1 text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                Open disputes page
              </Link>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-stone-200">
          <p className="text-sm text-stone-600">
            Technical verification (MATCH/MISMATCH/PENDING/UNAVAILABLE) is system-controlled and cannot be
            changed by human review. Corrections and disputes create new evidence versions and verification
            records, preserving the original history.
          </p>
        </div>

        {evidenceId && milestoneId && (
          <div className="pt-4 border-t border-stone-200">
            <p className="text-sm font-medium text-stone-900">Current context:</p>
            <dl className="mt-2 grid gap-2 sm:grid-cols-3 text-xs">
              <div>
                <dt className="text-stone-500">Evidence</dt>
                <dd className="font-mono break-all text-stone-900">{evidenceId}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Milestone</dt>
                <dd className="font-mono break-all text-stone-900">{milestoneId}</dd>
              </div>
              <div>
                <dt className="text-stone-500">Project</dt>
                <dd className="font-mono break-all text-stone-900">{projectId ?? "Not provided"}</dd>
              </div>
            </dl>
          </div>
        )}
      </div>
    </Card>
  );
}