import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { StateLabel } from "../../shared/StateLabel";
import { queryErrorMessage } from "../../shared/query";
import { getContractor } from "../../contractors/api/contractorsApi";
import type { PublicContractor } from "../../contractors/types";
import { getProject } from "../api/projectsApi";
import type { PublicProject } from "../types";

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const location = useLocation();
  const notice = (location.state as { notice?: unknown } | null)?.notice;
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "loaded"; project: PublicProject; contractor: PublicContractor }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!projectId) {
      setState({ status: "error", message: "A project identifier is required." });
      return;
    }
    let active = true;
    setState({ status: "loading" });
    getProject(projectId)
      .then(async (project) => ({ project, contractor: await getContractor(project.contractorId) }))
      .then(({ project, contractor }) => {
        if (active) setState({ status: "loaded", project, contractor });
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
  }, [projectId, reloadKey]);

  return (
    <section className="space-y-6">
      <PageHeader
        title="Project detail"
        description="Project identity and contract metadata returned by the backend."
      />
      <p>
        <Link
          to="/projects"
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          Back to projects
        </Link>
      </p>
      {notice === "Project created successfully." ? (
        <p role="status" className="rounded-md border border-green-800 bg-green-50 px-4 py-3 text-sm font-medium text-green-900">
          Project created successfully.
        </p>
      ) : null}
      {state.status === "loading" ? <LoadingState message="Loading project information..." /> : null}
      {state.status === "error" ? (
        <ErrorState message={state.message} onRetry={() => setReloadKey((key) => key + 1)} />
      ) : null}
      {state.status === "loaded" ? (
        <>
          <Card title="Project overview">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Project name" value={state.project.name} />
              <Field label="Project identifier" value={state.project.id} mono />
              <Field label="Contractor">
                <Link className="text-teal-900 underline underline-offset-4" to={`/contractors/${encodeURIComponent(state.contractor.id)}`}>
                  {state.contractor.legalName}
                </Link>
              </Field>
              <Field label="Contractor identifier" value={state.project.contractorId} mono />
              <Field label="Contract status">
                {state.project.contractStatus ? <StateLabel value={state.project.contractStatus} /> : "Not supplied"}
              </Field>
              <Field label="Description" value={state.project.description} />
              <Field label="Contract start" value={state.project.contractStartDate} />
              <Field label="Contract end" value={state.project.contractEndDate} />
              <Field label="NeST tender reference" value={state.project.nestTenderReference} />
              <Field label="NeST contract reference" value={state.project.nestContractReference} />
              <Field label="Open Contracting ID" value={state.project.ocid} />
              <Field label="Procuring entity" value={state.project.procuringEntity} />
              <Field label="Source" value={state.project.nestSource} />
              <Field label="Created" value={state.project.createdAt} />
              <Field label="Updated" value={state.project.updatedAt} />
            </dl>
          </Card>
          <Card title="Related records" description="Project milestones and evidence have separate routes and are outside this task's workflow scope.">
            <p className="text-sm text-stone-700">No related records are loaded on this page.</p>
          </Card>
        </>
      ) : null}
    </section>
  );
}

function Field({
  label,
  value,
  mono = false,
  children,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  children?: import("react").ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-semibold uppercase text-stone-500">{label}</dt>
      <dd className={`mt-1 break-words text-sm text-stone-900 ${mono ? "font-mono" : ""}`}>
        {children ?? value ?? "Not supplied"}
      </dd>
    </div>
  );
}
