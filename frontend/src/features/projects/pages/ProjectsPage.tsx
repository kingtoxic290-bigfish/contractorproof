import { Link } from "react-router-dom";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { QueryPanel } from "../../shared/QueryPanel";
import { NestLookupForm } from "../components/NestLookupForm";
import { ProjectList } from "../components/ProjectList";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { status, records, error, retry } = useProjects();
  const { hasRole } = useAuth();
  const canCreateProject = hasRole("CONTRACTOR", "ADMIN");

  return (
    <section className="space-y-6">
      <PageHeader
        title="Projects"
        description="Project records from the ContractorProof API. Status values are shown exactly as returned. This is not a completion or trust score."
        actions={
          canCreateProject ? (
            <Link
              to="/projects/new"
              className="inline-flex items-center justify-center rounded-md bg-[#0f3d3a] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#0d3331] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            >
              New project
            </Link>
          ) : null
        }
      />
      <QueryPanel
        status={status}
        error={error}
        onRetry={() => void retry()}
        loadingMessage="Loading project information..."
        emptyTitle="No projects available."
        emptyDescription="The API returned no project records."
      >
        <ProjectList records={records} />
      </QueryPanel>
      <NestLookupForm />
    </section>
  );
}
