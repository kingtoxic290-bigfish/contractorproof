import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { DataTable } from "../../../components/ui/DataTable";
import { EmptyState } from "../../../components/feedback/EmptyState";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { queryErrorMessage } from "../../shared/query";
import { getContractor } from "../api/contractorsApi";
import type { PublicContractor } from "../types";
import { listProjects } from "../../projects/api/projectsApi";
import type { PublicProject } from "../../projects/types";

export function ContractorDetailPage() {
  const { contractorId } = useParams();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; contractor: PublicContractor; projects: PublicProject[] }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!contractorId) {
      setState({ status: "error", message: "A contractor identifier is required." });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    Promise.all([getContractor(contractorId), listProjects()])
      .then(([contractor, projects]) => {
        if (active) {
          setState({
            status: "loaded",
            contractor,
            projects: projects.filter((project) => project.contractorId === contractor.id),
          });
        }
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
  }, [contractorId, reloadKey]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Contractor detail"
        description="Contractor identity and only the projects returned within your backend-authorized scope."
      />
      <p>
        <Link
          to="/contractors"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to contractors
        </Link>
      </p>
      {state.status === "loading" ? <LoadingState message="Loading contractor and project records..." /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : null}
      {state.status === "loaded" ? (
        <>
          <Card title="Contractor record">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name" value={state.contractor.legalName} />
              <Field label="Contractor identifier" value={state.contractor.id} mono />
              <Field label="CRB registration" value={state.contractor.crbRegistrationNumber} />
              <Field label="CRB category" value={state.contractor.crbCategory} />
              <Field label="CRB type" value={state.contractor.crbType} />
              <Field label="CRB class" value={state.contractor.crbClass} />
              <Field label="CRB status" value={state.contractor.crbStatus} />
              <Field label="CRB source" value={state.contractor.crbSource} />
              <Field label="CRB last verified" value={state.contractor.crbLastVerifiedAt} />
            </dl>
          </Card>
          <Card title="Projects" description="Projects are filtered from the authenticated project list returned by the backend.">
            {state.projects.length === 0 ? (
              <EmptyState title="No projects associated with this contractor." description="No accessible project records in the API response reference this contractor." />
            ) : (
              <DataTable
                headers={["Project", "Identifier", "Status", "Start date", "End date"]}
                rows={state.projects.map((project) => [
                  <Link className="font-semibold text-teal-900 underline underline-offset-4" to={`/projects/${encodeURIComponent(project.id)}`}>
                    {project.name}
                  </Link>,
                  <span className="break-all font-mono text-xs">{project.id}</span>,
                  project.contractStatus ?? "Not supplied",
                  project.contractStartDate ?? "Not supplied",
                  project.contractEndDate ?? "Not supplied",
                ])}
              />
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
}

function Field({ label, value, mono = false }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-stone-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-stone-900 ${mono ? "font-mono" : ""}`}>
        {value ?? "Not supplied"}
      </dd>
    </div>
  );
}
