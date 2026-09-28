import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { DataTable } from "../../../components/ui/DataTable";
import { PageHeader } from "../../../components/ui/PageHeader";
import { Panel } from "../../../components/ui/Panel";
import { useAuth } from "../../../hooks/useAuth";
import { queryErrorMessage } from "../../shared/query";
import { listContractors } from "../../contractors/api/contractorsApi";
import type { PublicContractor } from "../../contractors/types";
import { listProjects } from "../api/projectsApi";
import type { PublicProject } from "../types";

export function ProjectsPage() {
  const { user } = useAuth();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; projects: PublicProject[]; contractors: PublicContractor[] }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    Promise.all([listProjects(), listContractors()])
      .then(([projects, contractors]) => {
        if (active) setState({ status: "loaded", projects, contractors });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            status: "error",
            message: queryErrorMessage(error),
          });
        }
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const canCreate = user?.role === "ADMIN" || user?.role === "CONTRACTOR";

  return (
    <section className="space-y-6">
      <PageHeader
        title="Projects"
        description="Project records returned within your backend-authorized scope."
        actions={canCreate ? (
          <Link className="inline-flex min-h-10 items-center justify-center rounded-md bg-[#0f3d3a] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d3331] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800" to="/projects/new">
            Create project
          </Link>
        ) : null}
      />
      {state.status === "loading" ? <LoadingState message="Loading projects and contractor records..." /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : null}
      {state.status === "loaded" ? (
        <Panel>
          {state.projects.length === 0 ? (
            <EmptyState title="No projects available." description="The backend returned no project records accessible to this account." />
          ) : (
            <DataTable
              headers={["Project", "Identifier", "Contractor", "Status", "Start date", "End date"]}
              rows={state.projects.map((project) => {
                const contractor = state.contractors.find((record) => record.id === project.contractorId);
                return [
                  <Link className="font-semibold text-teal-900 underline underline-offset-4" to={`/projects/${encodeURIComponent(project.id)}`}>
                    {project.name}
                  </Link>,
                  <span className="break-all font-mono text-xs">{project.id}</span>,
                  contractor ? (
                    <Link className="text-teal-900 underline underline-offset-4" to={`/contractors/${encodeURIComponent(contractor.id)}`}>
                      {contractor.legalName}
                    </Link>
                  ) : project.contractorId,
                  project.contractStatus ?? "Not supplied",
                  project.contractStartDate ?? "Not supplied",
                  project.contractEndDate ?? "Not supplied",
                ];
              })}
            />
          )}
        </Panel>
      ) : null}
    </section>
  );
}
