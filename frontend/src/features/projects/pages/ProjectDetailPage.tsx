import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { MilestoneList } from "../../milestones/components/MilestoneList";
import { useProjectMilestones } from "../../milestones/hooks/useProjectMilestones";
import { QueryPanel } from "../../shared/QueryPanel";
import { RecordFields } from "../../shared/RecordFields";
import { useProject } from "../hooks/useProject";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const project = useProject(projectId);
  const milestones = useProjectMilestones(projectId);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Project"
        description="Project identity and milestones are loaded from separate API routes. Historical events will be listed here when those APIs exist; original records will not be overwritten in the interface."
      />
      <p>
        <Link
          to="/projects"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to projects
        </Link>
      </p>
      <QueryPanel
        status={project.status}
        error={project.error}
        onRetry={() => void project.retry()}
        loadingMessage="Loading project information..."
      >
        {project.data ? (
          <Card title="Project record">
            <RecordFields record={project.data} />
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={`/evidence?projectId=${encodeURIComponent(project.data.id)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View project evidence
              </Link>
              <Link
                to={`/projects/${encodeURIComponent(project.data.id)}/milestones/new`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                Create milestone
              </Link>
              <Link
                to={`/passports/${encodeURIComponent(project.data.contractorId)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View contractor project history
              </Link>
            </div>
          </Card>
        ) : null}
      </QueryPanel>
      <div>
        <h2 className="mb-3 font-serif text-xl text-stone-900">Milestones</h2>
        <QueryPanel
          status={milestones.status}
          error={milestones.error}
          onRetry={() => void milestones.retry()}
          loadingMessage="Loading milestone information..."
          emptyTitle="No milestones available."
          emptyDescription="The API returned no milestone records for this project."
        >
          <MilestoneList records={milestones.records} projectId={projectId} />
        </QueryPanel>
      </div>
    </section>
  );
}
