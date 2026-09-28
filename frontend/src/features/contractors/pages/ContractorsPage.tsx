import { PageHeader } from "../../../components/ui/PageHeader";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { DataTable } from "../../../components/ui/DataTable";
import { Panel } from "../../../components/ui/Panel";
import { queryErrorMessage } from "../../shared/query";
import { listContractors } from "../api/contractorsApi";
import { CrbLookupForm } from "../components/CrbLookupForm";
import type { PublicContractor } from "../types";
import { listProjects } from "../../projects/api/projectsApi";
import type { PublicProject } from "../../projects/types";

export function ContractorsPage() {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; contractors: PublicContractor[]; projects: PublicProject[] }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setState({ status: "loading" });
    Promise.all([listContractors(), listProjects()])
      .then(([contractors, projects]) => {
        if (active) setState({ status: "loaded", contractors, projects });
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

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractors"
        description="Contractor records and associated projects returned within your authorized API scope."
      />
      {state.status === "loading" ? <LoadingState message="Loading contractor and project records..." /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : null}
      {state.status === "loaded" ? (
        <Panel>
          {state.contractors.length === 0 ? (
            <EmptyState title="No contractors available." description="The backend returned no contractor records accessible to this account." />
          ) : (
            <DataTable
              headers={["Contractor", "Identifier", "Registration", "Category", "Type", "Status", "Projects"]}
              rows={state.contractors.map((contractor) => [
                <Link className="font-semibold text-teal-900 underline underline-offset-4" to={`/contractors/${encodeURIComponent(contractor.id)}`}>
                  {contractor.legalName}
                </Link>,
                <span className="break-all font-mono text-xs">{contractor.id}</span>,
                contractor.crbRegistrationNumber ?? "Not supplied",
                contractor.crbCategory ?? "Not supplied",
                contractor.crbType ?? "Not supplied",
                contractor.crbStatus ?? "Not supplied",
                state.projects.filter((project) => project.contractorId === contractor.id).length,
              ])}
            />
          )}
        </Panel>
      ) : null}
      <CrbLookupForm />
    </section>
  );
}
