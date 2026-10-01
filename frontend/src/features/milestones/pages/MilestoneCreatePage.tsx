import { FormEvent, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { ApiError } from "../../../services/api/errors";
import { createMilestone } from "../api/milestonesApi";

function normalizeError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message || "The server rejected this milestone.";
  }
  return error instanceof Error ? error.message : "The server rejected this milestone.";
}

export function MilestoneCreatePage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!projectId) {
      setError("A project identifier is required.");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Milestone name is required.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await createMilestone(projectId, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      navigate(`/projects/${encodeURIComponent(projectId)}`);
    } catch (caught) {
      setError(normalizeError(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="New milestone"
        description="Add a milestone to this project. Milestones define the work stages for which evidence can be submitted."
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          to={projectId ? `/projects/${encodeURIComponent(projectId)}` : "/projects"}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to project
        </Link>
      </div>

      <Card
        title="Create milestone"
        description="Provide a name and an optional description. The server validates the required fields and your project access."
      >
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          <label className="block text-sm" htmlFor="milestone-name">
            <span className="mb-1 block font-medium text-stone-800">Milestone name</span>
            <input
              id="milestone-name"
              type="text"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (error === "Milestone name is required.") {
                  setError(null);
                }
              }}
              className="w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              aria-invalid={Boolean(error && !name.trim())}
              required
            />
          </label>

          <label className="block text-sm" htmlFor="milestone-description">
            <span className="mb-1 block font-medium text-stone-800">Description</span>
            <textarea
              id="milestone-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-[120px] w-full rounded-md border border-stone-300 bg-white px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            />
          </label>

          {error ? (
            <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create milestone"}
            </Button>
          </div>
        </form>
      </Card>
    </section>
  );
}
