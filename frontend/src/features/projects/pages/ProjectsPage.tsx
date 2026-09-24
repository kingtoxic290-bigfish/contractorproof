import { PageHeader } from "../../../components/ui/PageHeader";
import { QueryPanel } from "../../shared/QueryPanel";
import { NestLookupForm } from "../components/NestLookupForm";
import { ProjectList } from "../components/ProjectList";
import { useProjects } from "../hooks/useProjects";

export function ProjectsPage() {
  const { status, records, error, retry } = useProjects();

  return (
    <section className="space-y-6">
      <PageHeader
        title="Projects"
        description="Project records from the ContractorProof API. Status values are shown exactly as returned. This is not a completion or trust score."
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
