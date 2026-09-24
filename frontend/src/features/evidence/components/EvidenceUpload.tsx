import { FormEvent, useEffect, useId, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { useAuth } from "../../../hooks/useAuth";
import { listProjectMilestones } from "../../milestones/api/milestonesApi";
import { listProjects } from "../../projects/api/projectsApi";
import type { PublicMilestone } from "../../milestones/types";
import type { PublicProject } from "../../projects/types";
import { useEvidenceUpload } from "../hooks/useEvidenceUpload";
import type { PublicEvidence } from "../types";
import { EVIDENCE_ACCEPT, formatFileSize, isUuid } from "../validation";

const PHASE_LABEL: Record<string, string> = {
  ready: "Ready",
  uploading: "Uploading",
  uploaded: "Uploaded",
  failed: "Failed",
  unsupported: "Unsupported",
  too_large: "Too large",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  conflict: "Conflict",
  unavailable: "Server unavailable",
};

export function EvidenceUpload({
  initialMilestoneId,
  initialProjectId,
  onUploaded,
}: {
  initialMilestoneId?: string;
  initialProjectId?: string;
  onUploaded?: (evidence: PublicEvidence) => void;
}) {
  const { hasRole } = useAuth();
  const canUpload = hasRole("CONTRACTOR", "ADMIN");
  const fileInputId = useId();
  const projectInputId = useId();
  const milestoneInputId = useId();
  const { phase, error, result, upload, reset } = useEvidenceUpload();
  const [projects, setProjects] = useState<PublicProject[]>([]);
  const [milestones, setMilestones] = useState<PublicMilestone[]>([]);
  const [projectId, setProjectId] = useState(initialProjectId ?? "");
  const [milestoneId, setMilestoneId] = useState(initialMilestoneId ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    setProjectId(initialProjectId ?? "");
    setMilestoneId(initialMilestoneId ?? "");
  }, [initialMilestoneId, initialProjectId]);

  useEffect(() => {
    if (!canUpload) {
      return;
    }
    let cancelled = false;
    void listProjects()
      .then((rows) => {
        if (!cancelled) {
          setProjects(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("Project records could not be loaded for the upload form.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canUpload]);

  useEffect(() => {
    if (!canUpload || !projectId || !isUuid(projectId)) {
      setMilestones([]);
      return;
    }
    let cancelled = false;
    void listProjectMilestones(projectId)
      .then((rows) => {
        if (!cancelled) {
          setMilestones(rows);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMilestones([]);
          setLoadError("Milestone records could not be loaded for the selected project.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canUpload, projectId]);

  if (!canUpload) {
    return (
      <Card
        title="Upload evidence"
        description="Only CONTRACTOR and ADMIN accounts may upload evidence. The API remains authoritative."
      >
        <p className="text-sm text-stone-600">This account can view accessible evidence records but cannot upload files.</p>
      </Card>
    );
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!milestoneId || !file) {
      return;
    }
    const evidence = await upload(milestoneId, file);
    if (evidence) {
      onUploaded?.(evidence);
    }
  }

  return (
    <Card
      title="Upload evidence"
      description="Attach a file to an existing milestone. The file is stored, fingerprinted with SHA-256, and recorded as PENDING_VERIFICATION. Upload is not verification."
    >
      <form className="grid gap-4" onSubmit={onSubmit}>
        <div
          className="inline-flex w-fit items-center gap-2 rounded-full border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-medium text-stone-800"
          role="status"
          aria-live="polite"
          aria-label={`Upload state: ${PHASE_LABEL[phase]}`}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          <span>{PHASE_LABEL[phase]}</span>
        </div>

        <label className="block text-sm" htmlFor={projectInputId}>
          <span className="mb-1 block font-medium text-stone-800">Project</span>
          <select
            id={projectInputId}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setMilestoneId("");
              reset();
            }}
          >
            <option value="">Select a project</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm" htmlFor={milestoneInputId}>
          <span className="mb-1 block font-medium text-stone-800">Milestone</span>
          <select
            id={milestoneInputId}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            value={milestoneId}
            onChange={(event) => {
              setMilestoneId(event.target.value);
              reset();
            }}
            required
          >
            <option value="">{projectId ? "Select a milestone" : "Select a project first"}</option>
            {milestoneId && !milestones.some((milestone) => milestone.id === milestoneId) ? (
              <option value={milestoneId}>Milestone {milestoneId}</option>
            ) : null}
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm" htmlFor={fileInputId}>
          <span className="mb-1 block font-medium text-stone-800">Evidence file</span>
          <input
            id={fileInputId}
            type="file"
            accept={EVIDENCE_ACCEPT}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              reset();
            }}
            required
          />
        </label>

        {file ? (
          <p className="text-sm text-stone-700">
            Selected {file.name} · {file.type || "unknown type"} · {formatFileSize(file.size)}
          </p>
        ) : (
          <p className="text-sm text-stone-600">
            Allowed types: PDF, JPEG, PNG, WebP, TIFF, GIF, DOCX, XLSX, CSV, TXT. Maximum size 25 MB.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={phase === "uploading" || !file || !milestoneId}>
            Upload evidence
          </Button>
          {phase !== "ready" && phase !== "uploading" ? (
            <Button type="button" variant="secondary" onClick={reset}>
              Upload another file
            </Button>
          ) : null}
        </div>
      </form>

      <div className="mt-4 space-y-3">
        {phase === "uploading" ? <LoadingState message="Uploading evidence..." /> : null}
        {loadError ? <ErrorState message={loadError} /> : null}
        {error ? <ErrorState message={error} /> : null}
        {result ? (
          <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3" role="status">
            <p className="text-sm font-medium text-stone-900">The file was recorded as evidence.</p>
            <p className="mt-1 text-sm text-stone-700">
              Workflow status is {result.status}. Fingerprint comparison is {result.verificationStatus}.
              This is not a blockchain confirmation and does not prove the construction claim.
            </p>
            <p className="mt-2 break-all font-mono text-xs text-stone-800">SHA-256 {result.sha256}</p>
            {result.currentVersion ? (
              <p className="mt-2 text-sm text-stone-700">
                Current version {result.currentVersion.versionNumber} was created. Earlier versions are
                not replaced in the record history.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
