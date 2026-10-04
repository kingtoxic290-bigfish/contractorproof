import { useState } from "react";
import { Link } from "react-router-dom";
import { Plus, UserPlus } from "lucide-react";
import { Button } from "../../../components/ui/Button";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { userFacingError } from "../../../services/api/errors";
import { assignProjectContractor } from "../../projects/api/projectsApi";
import { useProjects } from "../../projects/hooks/useProjects";

/**
 * CLIENT action taken from a Contractor Passport.
 *
 * The next step of the discovery flow is selection: the contractor chosen here is
 * carried forward by the existing routes, PATCH /projects/:id/contractor for a
 * project that already exists, and POST /projects with the contractor preselected
 * for a new one. No separate assignment or invitation rule is introduced here,
 * and the client never has to supply an internal contractor identifier.
 */
export function SelectContractorPanel({
  contractor,
}: {
  contractor: { id: string; legalName: string; crbRegistrationNumber?: string | null };
}) {
  const projects = useProjects();
  const [projectId, setProjectId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const assignable = projects.records.filter((project) => project.contractorId !== contractor.id);
  // Only claim there is nothing to assign once the list has actually loaded.
  // Otherwise a failed request reads as "you own no projects".
  const projectsLoaded = projects.status === "success" || projects.status === "empty";
  // Name plus CRB Registration Number in one string: the selection the client
  // makes is recognisable without exposing any internal contractor identifier.
  const selectedLabel = contractor.crbRegistrationNumber
    ? `${contractor.legalName} · CRB Registration Number ${contractor.crbRegistrationNumber}`
    : `${contractor.legalName} · CRB Registration Number not provided`;

  async function submit() {
    if (!projectId) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setMessage(null);
    try {
      const updated = await assignProjectContractor(projectId, contractor.id);
      setMessage(`${updated.name} is now assigned to ${contractor.legalName}.`);
    } catch (cause) {
      setError(userFacingError(cause, "This contractor could not be assigned."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section aria-labelledby="select-contractor-heading" className="space-y-4">
      <div>
        <h2
          id="select-contractor-heading"
          className="flex items-center gap-2 font-serif text-xl text-stone-900"
        >
          <UserPlus className="h-5 w-5" aria-hidden="true" /> Select Contractor
        </h2>
        <p className="mt-1 text-sm text-stone-600">
          Selected contractor:{" "}
          <span className="font-medium text-stone-900">{selectedLabel}</span>. This identity is
          carried into any project you create or assign here.
        </p>
        <p className="mt-1 text-sm text-stone-600">
          Create a new project with this contractor, or assign them to a project you already own.
          ContractorProof records the assignment; the client remains the project owner.
        </p>
      </div>

      <div className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h3 className="text-sm font-semibold text-stone-900">Create a project</h3>
        <p className="mt-1 text-sm text-stone-600">
          This contractor is carried into the project form as the assigned contractor.
        </p>
        <p className="mt-3">
          <Link
            to={`/projects/new?contractorId=${encodeURIComponent(contractor.id)}`}
            className="inline-flex items-center gap-2 rounded-md bg-[#0f3d3a] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d3331] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Create a new project with this contractor
          </Link>
        </p>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-stone-900">Assign to an existing project</h3>
        <p className="mt-1 text-sm text-stone-600">
          Reassign a project you already own to this contractor.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="block min-w-0 flex-1 text-sm" htmlFor={`assign-to-project-${contractor.id}`}>
          <span className="mb-1 block font-medium text-stone-800">Project</span>
          <select
            id={`assign-to-project-${contractor.id}`}
            value={projectId}
            onChange={(event) => {
              setProjectId(event.target.value);
              setMessage(null);
              setError(null);
            }}
            disabled={submitting || assignable.length === 0 || !projectsLoaded}
            className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            <option value="">
              {projectsLoaded
                ? assignable.length === 0
                  ? "No project available to assign"
                  : "Select a project"
                : "Projects not loaded"}
            </option>
            {assignable.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} · {project.contractorName}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          disabled={submitting || !projectId}
          onClick={() => void submit()}
        >
          {submitting ? "Assigning..." : "Assign to project"}
        </Button>
      </div>

      {projects.status === "error" || projects.status === "forbidden" ||
        projects.status === "unauthorized" || projects.status === "unavailable" ? (
        <ErrorState message={projects.error ?? "Projects could not be loaded."} onRetry={() => void projects.retry()} />
      ) : null}
      {projects.status === "loading" ? (
        <p className="text-sm text-stone-600">Loading your projects...</p>
      ) : null}
      {projectsLoaded && assignable.length === 0 ? (
        <p className="text-sm text-stone-600">
          You have no project that can take this assignment yet. Create one with this
          contractor above.
        </p>
      ) : null}
      {error ? <ErrorState message={error} /> : null}
      {message ? (
        <p className="text-sm font-medium text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}