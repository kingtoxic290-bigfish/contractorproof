import { FormEvent, useEffect, useId, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { useAuth } from "../../../hooks/useAuth";
import { userFacingError } from "../../../services/api/errors";
import { getMilestone, listProjectMilestones } from "../../milestones/api/milestonesApi";
import { listProjects } from "../../projects/api/projectsApi";
import type { PublicMilestone } from "../../milestones/types";
import type { PublicProject } from "../../projects/types";
import { useEvidenceUpload } from "../hooks/useEvidenceUpload";
import type { EvidenceUploadPhase, PublicEvidence } from "../types";
import { EVIDENCE_ACCEPT, formatFileSize, isUuid } from "../validation";

const PHASE_LABEL: Record<EvidenceUploadPhase, string> = {
  ready: "Ready",
  uploading: "Uploading",
  uploaded: "Uploaded",
  failed: "Failed",
  unsupported: "Unsupported",
  too_large: "Too large",
  unauthorized: "Unauthorized",
  forbidden: "Forbidden",
  notfound: "Not found",
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
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [loadingMilestones, setLoadingMilestones] = useState(false);

  useEffect(() => {
    setProjectId(initialProjectId ?? "");
    setMilestoneId(initialMilestoneId ?? "");
  }, [initialMilestoneId, initialProjectId]);

  useEffect(() => {
    if (!canUpload) {
      return;
    }
    let cancelled = false;
    setLoadingProjects(true);
    void listProjects()
      .then((rows) => {
        if (!cancelled) {
          setProjects(rows);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(userFacingError(cause, "Project records could not be loaded for the upload form."));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingProjects(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canUpload]);

  useEffect(() => {
    if (!canUpload || !initialMilestoneId || initialProjectId) {
      return;
    }
    let cancelled = false;
    void getMilestone(initialMilestoneId)
      .then((milestone) => {
        if (!cancelled) {
          setProjectId(milestone.projectId);
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setLoadError(userFacingError(cause, "The selected milestone could not be loaded."));
          setMilestoneId("");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [canUpload, initialMilestoneId, initialProjectId]);

  useEffect(() => {
    if (!canUpload || !projectId || !isUuid(projectId)) {
      setMilestones([]);
      return;
    }
    let cancelled = false;
    setLoadingMilestones(true);
    void listProjectMilestones(projectId)
      .then((rows) => {
        if (!cancelled) {
          setMilestones(rows);
          setMilestoneId((selected) => (rows.some((row) => row.id === selected) ? selected : ""));
        }
      })
      .catch((cause: unknown) => {
        if (!cancelled) {
          setMilestones([]);
          setMilestoneId("");
          setLoadError(
            userFacingError(cause, "Milestone records could not be loaded for the selected project."),
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingMilestones(false);
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
      icon={UploadCloud}
    >
      <form className="grid gap-4" onSubmit={onSubmit} noValidate>
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
              setLoadError(null);
              reset();
            }}
            disabled={loadingProjects}
          >
            <option value="">{loadingProjects ? "Loading projects..." : "Select a project"}</option>
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
            disabled={!projectId || loadingMilestones || milestones.length === 0}
            required
          >
            <option value="">
              {loadingMilestones
                ? "Loading milestones..."
                : !projectId
                  ? "Select a project first"
                  : milestones.length
                    ? "Select a milestone"
                    : "No milestones available"}
            </option>
            {milestones.map((milestone) => (
              <option key={milestone.id} value={milestone.id}>
                {milestone.name}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0f3d3a] shadow-sm">
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-stone-900">Evidence file</p>
              <p className="mt-1 text-sm text-stone-600">Choose a document to attach to the selected milestone.</p>
            </div>
          </div>

          <label className="mt-4 block text-sm" htmlFor={fileInputId}>
            <span className="mb-1 block font-medium text-stone-800">Evidence file</span>
            <input
              id={fileInputId}
              type="file"
              accept={EVIDENCE_ACCEPT}
              className="block w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-[#0f3d3a] file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                reset();
              }}
              required
            />
          </label>
        </div>

        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-stone-700 shadow-sm">
              <FileText className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-stone-900">Selected {file.name}</p>
              <p className="text-xs text-stone-600">{file.type || "unknown type"} · {formatFileSize(file.size)}</p>
            </div>
          </div>
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
