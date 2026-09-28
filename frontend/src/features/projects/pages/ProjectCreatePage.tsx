import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { ApiError } from "../../../services/api/errors";
import { createProject } from "../api/projectsApi";

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || "The server rejected this project.";
  }
  return error instanceof Error ? error.message : "The server rejected this project.";
}

export function ProjectCreatePage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successId, setSuccessId] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Project name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessId(null);

    try {
      const created = await createProject({
        name: trimmed,
        description: description.trim() || undefined,
        contractStatus: status.trim() || undefined,
      });
      setSuccessId(created.id);
      setName("");
      setDescription("");
      setStatus("");
    } catch (caught) {
      setError(normalizeError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="New project"
        description="Create a project using the backend's real create endpoint. The backend remains authoritative for role checks and validation."
      />
      <div className="flex items-center justify-between gap-3">
        <Link
          to="/projects"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to projects
        </Link>
      </div>

      <Card title="Create project" description="Only required fields are enforced on the client; the backend validates the final payload.">
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="block text-sm" htmlFor="project-name">
            <span className="mb-1 block font-medium text-stone-800">Project name</span>
            <input
              id="project-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error === "Project name is required.") {
                  setError(null);
                }
              }}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              aria-invalid={Boolean(error && !name.trim())}
              required
            />
          </label>

          <label className="block text-sm" htmlFor="project-description">
            <span className="mb-1 block font-medium text-stone-800">Description</span>
            <textarea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[120px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            />
          </label>

          <label className="block text-sm" htmlFor="project-status">
            <span className="mb-1 block font-medium text-stone-800">Status</span>
            <input
              id="project-status"
              type="text"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              placeholder="For example: ACTIVE"
            />
          </label>

          {error ? (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {successId ? (
            <div className="space-y-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-700">
              <p>Project created successfully.</p>
              <Link
                to={`/projects/${encodeURIComponent(successId)}`}
                className="inline-flex items-center rounded-md bg-emerald-700 px-3 py-2 font-medium text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
              >
                Open project
              </Link>
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create project"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
