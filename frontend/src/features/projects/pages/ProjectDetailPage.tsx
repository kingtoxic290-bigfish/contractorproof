import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { PageHeader } from "../../../components/ui/PageHeader";
import { useAuth } from "../../../hooks/useAuth";
import { useProjectMilestones } from "../../milestones/hooks/useProjectMilestones";
import { QueryPanel } from "../../shared/QueryPanel";
import { RecordFields } from "../../shared/RecordFields";
import { ContractorAssignmentPanel } from "../components/ContractorAssignmentPanel";
import { useProject } from "../hooks/useProject";
import { useEvidence } from "../../evidence/hooks/useEvidence";
import { VerificationStatus } from "../../verification/components/VerificationStatus";
import { EvidenceStatus } from "../../evidence/components/EvidenceStatus";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function MilestoneDetail({
  milestone,
  projectId,
  canReview,
}: {
  milestone: {
    id: string;
    projectId: string;
    name: string;
    description?: string | null;
    status: string;
    policyId?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  projectId?: string;
  canReview: boolean;
}) {
  const evidence = useEvidence(milestone.id, undefined, true);
  const evidenceRecords = evidence.records ?? [];
  const evidenceCount = evidenceRecords.length;

  const latestEvidence = evidenceRecords[0];
  const verificationStatus = latestEvidence?.verificationStatus ?? "PENDING";
  const workflowStatus = latestEvidence?.status ?? "NO_EVIDENCE";

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs text-stone-500">Project {milestone.projectId}</span>
      </div>
      <h3 className="mb-3 min-w-0 break-words text-base font-medium text-stone-900">
        <Link
          to={`/milestones/${encodeURIComponent(milestone.id)}`}
          className="underline decoration-stone-400 underline-offset-4 hover:text-teal-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          {milestone.name}
        </Link>
      </h3>

      <div className="mb-3 grid gap-2 sm:grid-cols-3 text-xs">
        <div>
          <dt className="text-stone-500">Evidence records</dt>
          <dd className="font-medium text-stone-900">{evidenceCount}</dd>
        </div>
        <div>
          <dt className="text-stone-500">Technical verification</dt>
          <dd className="font-medium text-stone-900">
            <VerificationStatus status={verificationStatus} />
          </dd>
        </div>
        <div>
          <dt className="text-stone-500">Workflow status</dt>
          <dd className="font-medium text-stone-900">
            <EvidenceStatus status={workflowStatus} verificationStatus={verificationStatus} />
          </dd>
        </div>
      </div>

      {latestEvidence && (
        <div className="mb-3 p-3 rounded-lg border border-stone-200 bg-stone-50 text-xs">
          <p className="font-medium text-stone-900">{latestEvidence.fileName}</p>
          <p className="text-stone-600">
            {latestEvidence.mimeType} · {formatFileSize(latestEvidence.sizeBytes)}
          </p>
          <p className="mt-1 font-mono break-all text-stone-700">SHA-256: {latestEvidence.sha256}</p>
        </div>
      )}

      <RecordFields
        record={{
          ...milestone,
          description: milestone.description ?? undefined,
        }}
      />

      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          to={`/evidence?milestoneId=${encodeURIComponent(milestone.id)}`}
          className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        >
          View evidence
        </Link>
        {canReview && evidenceCount > 0 && (
          <Link
            to={`/verification?evidenceId=${encodeURIComponent(evidenceRecords[0].id)}&milestoneId=${encodeURIComponent(milestone.id)}${projectId ? `&projectId=${encodeURIComponent(projectId)}` : ""}`}
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Review evidence
          </Link>
        )}
      </div>
    </Card>
  );
}

export function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user, hasRole } = useAuth();
  const canManageProject = hasRole("CLIENT", "ADMIN");
  const canReview = hasRole("ADMIN", "AUDITOR", "PROCUREMENT_OFFICER");
  const project = useProject(projectId);
  const [assignedProject, setAssignedProject] = useState<typeof project.data>(null);
  const projectData = assignedProject ?? project.data;
  const milestones = useProjectMilestones(projectId);

  return (
    <section className="space-y-6">
      <PageHeader
        title={projectData?.name ?? "Project"}
        description={user?.role === "CONTRACTOR"
          ? "This project was assigned to your contractor account. Review its milestones and submit permitted evidence."
          : "Review project ownership, contractor assignment, milestones, evidence, and verification activity."}
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
        {projectData ? (
          <Card title="Project record">
            {canManageProject ? (
              <ContractorAssignmentPanel
                projectId={projectData.id}
                contractorId={projectData.contractorId}
                onAssigned={setAssignedProject}
              />
            ) : null}
            <dl className="mb-4 grid gap-3 border-b border-stone-200 pb-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-500">Client</dt>
                <dd className="mt-1 text-sm font-medium text-stone-900">
                  {projectData.clientName ?? (user?.role === "CLIENT" ? `${user.fullName} (you)` : "Client not provided")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-stone-500">Assigned contractor</dt>
                <dd className="mt-1 text-sm font-medium text-stone-900">
                  {projectData.contractorName} · {projectData.contractorId}
                </dd>
              </div>
            </dl>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Project reference</dt>
                <dd className="mt-1 break-all font-mono text-xs text-stone-800">{projectData.nestContractReference ?? projectData.nestTenderReference ?? projectData.ocid ?? projectData.id}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Procuring entity</dt>
                <dd className="mt-1 break-words text-sm text-stone-900">{projectData.procuringEntity ?? "Not provided"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Contract dates</dt>
                <dd className="mt-1 text-sm text-stone-900">
                  {projectData.contractStartDate ?? "Not provided"}
                  {projectData.contractEndDate ? ` – ${projectData.contractEndDate}` : ""}
                </dd>
              </div>
              {projectData.description ? (
                <div className="sm:col-span-2 lg:col-span-3">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-stone-500">Project description</dt>
                  <dd className="mt-1 whitespace-pre-wrap text-sm leading-6 text-stone-800">{projectData.description}</dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                to={`/evidence?projectId=${encodeURIComponent(projectData.id)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View project evidence
              </Link>
              {canManageProject ? (
                <Link
                  to={`/projects/${encodeURIComponent(projectData.id)}/milestones/new`}
                  className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  Create milestone
                </Link>
              ) : null}
              <Link
                to={`/passports/${encodeURIComponent(projectData.id)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View project Passport
              </Link>
            </div>
          </Card>
        ) : null}
      </QueryPanel>
      <div>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-serif text-xl text-stone-900">Milestones</h2>
            <p className="mt-1 text-sm text-stone-600">Project work is organized by milestones; evidence and verification are attached at that level.</p>
          </div>
          {canManageProject && projectData ? (
            <Link to={`/projects/${encodeURIComponent(projectData.id)}/milestones/new`} className="text-sm font-semibold text-teal-900 underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800">
              Add milestone
            </Link>
          ) : null}
        </div>
        <QueryPanel
          status={milestones.status}
          error={milestones.error}
          onRetry={() => void milestones.retry()}
          loadingMessage="Loading milestone information..."
          emptyTitle="No milestones available."
          emptyDescription="No milestone records were found for this project."
        >
          <ul className="grid gap-4">
            {milestones.records.map((record) => (
              <li key={record.id}>
                <MilestoneDetail milestone={record} projectId={projectId} canReview={canReview} />
              </li>
            ))}
          </ul>
        </QueryPanel>
      </div>
    </section>
  );
}