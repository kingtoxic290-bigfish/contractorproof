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
  const canCreateProject = hasRole("CLIENT", "ADMIN");
  const isContractor = hasRole("CONTRACTOR");
  const isClient = hasRole("CLIENT");
  const isAdmin = hasRole("ADMIN");
  const isReviewer = hasRole("AUDITOR", "PROCUREMENT_OFFICER");

  const emptyTitle = isContractor
    ? "No projects assigned to you yet."
    : isClient
      ? "No projects yet."
      : isReviewer
        ? "No projects available for review."
        : "No projects available.";
  const emptyDescription = isContractor
    ? "Projects assigned to you by clients will appear here."
    : isClient
      ? "Create your first project to begin assigning contractors."
      : isReviewer
        ? "Projects within your authorized review scope will appear here."
        : "No projects are available to this account.";

  return (
    <section className="space-y-6">
      <PageHeader
        title={isContractor ? "My Assigned Projects" : "Projects"}
        description={isContractor
          ? "These are projects assigned to you. Open a project to review its milestones and submit evidence."
          : isClient
            ? "Manage your projects, contractor assignments, milestones, and evidence."
            : isAdmin
              ? "Manage system projects and contractor assignments, and review authorized evidence."
              : "Projects available within your authorized oversight scope."}
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
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      >
        <ProjectList records={records} />
      </QueryPanel>
      {canCreateProject ? <NestLookupForm /> : null}
    </section>
  );
}
