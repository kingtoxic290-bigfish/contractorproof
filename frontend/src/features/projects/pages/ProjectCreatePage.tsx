import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ErrorState } from "../../../components/feedback/ErrorState";
import { LoadingState } from "../../../components/feedback/LoadingState";
import { Button } from "../../../components/ui/Button";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { ApiError } from "../../../services/api/errors";
import { listContractors } from "../../contractors/api/contractorsApi";
import type { PublicContractor } from "../../contractors/types";
import { createProject, type CreateProjectInput } from "../api/projectsApi";

type ProjectForm = {
  name: string;
  description: string;
  contractorId: string;
  nestTenderReference: string;
  nestContractReference: string;
  ocid: string;
  procuringEntity: string;
  contractStatus: string;
  contractStartDate: string;
  contractEndDate: string;
};

const INITIAL_FORM: ProjectForm = {
  name: "",
  description: "",
  contractorId: "",
  nestTenderReference: "",
  nestContractReference: "",
  ocid: "",
  procuringEntity: "",
  contractStatus: "",
  contractStartDate: "",
  contractEndDate: "",
};

export function ProjectCreatePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isAdmin = user?.role === "ADMIN";
  const [form, setForm] = useState(INITIAL_FORM);
  const [contractors, setContractors] = useState<PublicContractor[]>([]);
  const [contractorStatus, setContractorStatus] = useState<"idle" | "loading" | "loaded" | "error">(
    isAdmin ? "loading" : "idle",
  );
  const [contractorError, setContractorError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    let active = true;
    setContractorStatus("loading");
    listContractors()
      .then((records) => {
        if (!active) return;
        setContractors(records);
        setContractorStatus("loaded");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setContractorError(cause instanceof Error ? cause.message : "Contractors could not be loaded.");
        setContractorStatus("error");
      });
    return () => {
      active = false;
    };
  }, [isAdmin]);

  function update(field: keyof ProjectForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldError(null);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setFieldError("Project name is required.");
      return;
    }
    if (isAdmin && !form.contractorId) {
      setFieldError("Select a contractor for this project.");
      return;
    }

    const input: CreateProjectInput = { name };
    for (const key of [
      "description",
      "contractorId",
      "nestTenderReference",
      "nestContractReference",
      "ocid",
      "procuringEntity",
      "contractStatus",
    ] as const) {
      const value = form[key].trim();
      if (value && (key !== "contractorId" || isAdmin)) input[key] = value;
    }
    if (form.contractStartDate) input.contractStartDate = new Date(form.contractStartDate).toISOString();
    if (form.contractEndDate) input.contractEndDate = new Date(form.contractEndDate).toISOString();

    setSubmitting(true);
    setError(null);
    setFieldError(null);
    try {
      const project = await createProject(input);
      navigate(`/projects/${encodeURIComponent(project.id)}`, {
        state: { notice: "Project created successfully." },
      });
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 400) {
        setFieldError(cause.message);
      } else if (cause instanceof ApiError && cause.status === 403) {
        setError("The backend did not authorize project creation for this account.");
      } else if (cause instanceof ApiError && cause.status === 409) {
        setError(cause.message || "The project conflicts with an existing record.");
      } else {
        setError(cause instanceof Error ? cause.message : "Project creation failed.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <PageHeader
        title="Create project"
        description={isAdmin
          ? "Create a project for a contractor returned by the authenticated contractor API."
          : "Create a project for the contractor account authenticated by your session."}
      />
      <p>
        <Link className="text-sm font-semibold text-teal-900 underline underline-offset-4" to="/projects">
          Back to projects
        </Link>
      </p>
      {error ? <ErrorState message={error} /> : null}
      {isAdmin && contractorStatus === "error" ? <ErrorState message={contractorError ?? "Contractors could not be loaded."} /> : null}
      {isAdmin && contractorStatus === "loading" ? <LoadingState message="Loading authorized contractors..." /> : null}
      <Card title="Project information" description="Only fields supported by the project API are included.">
        <form className="space-y-5" onSubmit={(event) => void submit(event)} noValidate>
          {isAdmin ? (
            <label className="block text-sm font-medium text-stone-800">
              Contractor <span aria-hidden="true">*</span>
              <select
                className="mt-1 block min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-2"
                value={form.contractorId}
                onChange={(event) => update("contractorId", event.target.value)}
                required
                disabled={contractorStatus !== "loaded" || contractors.length === 0}
              >
                <option value="">Select a contractor</option>
                {contractors.map((contractor) => (
                  <option value={contractor.id} key={contractor.id}>{contractor.legalName}</option>
                ))}
              </select>
            </label>
          ) : null}
          <TextField label="Project name" required value={form.name} onChange={(value) => update("name", value)} />
          <TextField label="Description" value={form.description} onChange={(value) => update("description", value)} multiline />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Contract status" value={form.contractStatus} onChange={(value) => update("contractStatus", value)} />
            <TextField label="Procuring entity" value={form.procuringEntity} onChange={(value) => update("procuringEntity", value)} />
            <TextField label="NeST tender reference" value={form.nestTenderReference} onChange={(value) => update("nestTenderReference", value)} />
            <TextField label="NeST contract reference" value={form.nestContractReference} onChange={(value) => update("nestContractReference", value)} />
            <TextField label="Open Contracting ID" value={form.ocid} onChange={(value) => update("ocid", value)} />
            <TextField label="Contract start date" type="date" value={form.contractStartDate} onChange={(value) => update("contractStartDate", value)} />
            <TextField label="Contract end date" type="date" value={form.contractEndDate} onChange={(value) => update("contractEndDate", value)} />
          </div>
          {fieldError ? <p className="text-sm font-medium text-red-800" role="alert">{fieldError}</p> : null}
          <Button
            type="submit"
            disabled={submitting || (isAdmin && (contractorStatus !== "loaded" || contractors.length === 0))}
          >
            {submitting ? "Creating project..." : "Create project"}
          </Button>
          {submitting ? <LoadingState message="Creating project..." /> : null}
        </form>
      </Card>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  multiline?: boolean;
}) {
  const inputClass = "mt-1 block min-h-10 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800";
  return (
    <label className="block min-w-0 text-sm font-medium text-stone-800">
      {label}{required ? <span aria-hidden="true"> *</span> : null}
      {multiline ? (
        <textarea className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} rows={3} />
      ) : (
        <input className={inputClass} value={value} onChange={(event) => onChange(event.target.value)} type={type} required={required} />
      )}
    </label>
  );
}