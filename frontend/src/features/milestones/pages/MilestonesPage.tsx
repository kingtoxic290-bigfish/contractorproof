import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { MilestoneList } from "../components/MilestoneList";
import { useProjectMilestones } from "../hooks/useProjectMilestones";

export function MilestonesPage() {
  const [projectIdInput, setProjectIdInput] = useState("");
  const [projectId, setProjectId] = useState<string | undefined>(undefined);
  const { status, records, error, retry } = useProjectMilestones(projectId);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = projectIdInput.trim();
    setProjectId(value || undefined);
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Milestones"
        description="Milestones belong to a project. Enter a project identifier to load its milestones, or open milestones directly from a project."
      />
      <Card title="Load milestones for a project">
        <form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={onSubmit}>
          <label className="block min-w-0 flex-1 text-sm" htmlFor="milestone-project-id">
            <span className="mb-1 block font-medium text-stone-800">Project identifier</span>
            <input
              id="milestone-project-id"
              className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              value={projectIdInput}
              onChange={(event) => setProjectIdInput(event.target.value)}
              autoComplete="off"
              required
            />
          </label>
          <Button type="submit">Load milestones</Button>
        </form>
        <p className="mt-3 text-sm text-stone-600">
          You can also open milestones from a{" "}
          <Link className="font-medium text-teal-900 underline underline-offset-2" to="/projects">
            project
          </Link>{" "}
          when a project identifier is available.
        </p>
      </Card>
      {/* QueryPanel renders nothing while idle, which would leave the page
          showing only the form above. */}
      {status === "idle" ? (
        <p className="text-sm text-stone-600">
          Enter a project identifier above to load its milestones, or open a project to see its
          milestones directly.
        </p>
      ) : null}
      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading milestone information..."
        emptyTitle="No milestones available."
        emptyDescription="No milestone records were found for this project."
      >
        <MilestoneList records={records} projectId={projectId} />
      </QueryPanel>
    </section>
  );
}
