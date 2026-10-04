import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export const PROJECT_LIFECYCLE_STATUSES = [
  "CREATED",
  "IN_PROGRESS",
  "EXECUTION_COMPLETE",
  "UNDER_FINAL_REVIEW",
  "COMPLETED",
] as const;

export type ProjectLifecycleStatus = (typeof PROJECT_LIFECYCLE_STATUSES)[number];

export function isProjectLifecycleStatus(value: unknown): value is ProjectLifecycleStatus {
  return (
    typeof value === "string" &&
    (PROJECT_LIFECYCLE_STATUSES as readonly string[]).includes(value)
  );
}

const LIFECYCLE_LABELS: Record<ProjectLifecycleStatus, string> = {
  CREATED: "Created",
  IN_PROGRESS: "In progress",
  EXECUTION_COMPLETE: "Execution complete",
  UNDER_FINAL_REVIEW: "Under final review",
  COMPLETED: "Completed",
};

const LIFECYCLE_MEANINGS: Record<ProjectLifecycleStatus, string> = {
  CREATED: "The project is recorded and assigned to a contractor. Milestone work has not started.",
  IN_PROGRESS: "Milestones are being executed. Evidence is submitted and verified milestone by milestone.",
  EXECUTION_COMPLETE:
    "Every recorded milestone reached the verified state. The project is not yet formally completed.",
  UNDER_FINAL_REVIEW: "Execution is complete and the project is in final review.",
  COMPLETED: "The project is formally completed. This is a client or administrator decision.",
};

export function projectLifecycleLabel(status: ProjectLifecycleStatus): string {
  return LIFECYCLE_LABELS[status];
}

export function projectLifecycleMeaning(status: ProjectLifecycleStatus): string {
  return LIFECYCLE_MEANINGS[status];
}

export type PublicProject = {
  id: string;
  clientId: string | null;
  clientName: string | null;
  contractorId: string;
  contractorName: string;
  /**
   * Identity of the assigned contractor. Optional so an older response that
   * omits it still parses; the project read gate is unchanged either way.
   */
  contractorCrbRegistrationNumber: string | null;
  name: string;
  description: string | null;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  procuringEntity: string | null;
  contractStatus: string | null;
  /**
   * Recorded project lifecycle state. Optional so a response that omits it
   * still parses; the server remains the only authority on transitions.
   */
  lifecycleStatus?: ProjectLifecycleStatus;
  contractStartDate: string | null;
  contractEndDate: string | null;
  nestSource: string;
  createdAt: string;
  updatedAt: string;
};

/** One recorded project lifecycle transition, exactly as the server stored it. */
export type ProjectLifecycleHistoryEntry = {
  id: string;
  projectId: string;
  sequence: number;
  previousStatus: string | null;
  newStatus: string;
  actorName: string | null;
  actorRole: string | null;
  isBaseline: boolean;
  reason: string | null;
  createdAt: string;
};

export function parseProjectLifecycleHistoryEntry(
  value: unknown,
): ProjectLifecycleHistoryEntry | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const projectId = asRequiredString(value.projectId);
  const newStatus = asRequiredString(value.newStatus);
  const createdAt = asRequiredString(value.createdAt);
  const sequence = value.sequence;
  const isBaseline = value.isBaseline;
  if (
    !id ||
    !projectId ||
    !newStatus ||
    !createdAt ||
    typeof sequence !== "number" ||
    !Number.isSafeInteger(sequence) ||
    typeof isBaseline !== "boolean"
  ) {
    return null;
  }

  return {
    id,
    projectId,
    sequence,
    previousStatus: asNullableString(value.previousStatus),
    newStatus,
    // actorName and actorRole are recorded facts. No internal actor identifier
    // is read from this payload or displayed.
    actorName: asNullableString(value.actorName),
    actorRole: asNullableString(value.actorRole),
    isBaseline,
    reason: asNullableString(value.reason),
    createdAt,
  };
}

export function parsePublicProject(value: unknown): PublicProject | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const clientId = asNullableString(value.clientId);
  const clientName = asNullableString(value.clientName);
  const contractorId = asRequiredString(value.contractorId);
  const contractorName = asRequiredString(value.contractorName);
  const name = asRequiredString(value.name);
  const nestSource = asRequiredString(value.nestSource);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  if (!id || !contractorId || !contractorName || !name || !nestSource || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    clientId,
    clientName,
    contractorId,
    contractorName,
    contractorCrbRegistrationNumber: asNullableString(value.contractorCrbRegistrationNumber),
    name,
    description: asNullableString(value.description),
    nestTenderReference: asNullableString(value.nestTenderReference),
    nestContractReference: asNullableString(value.nestContractReference),
    ocid: asNullableString(value.ocid),
    procuringEntity: asNullableString(value.procuringEntity),
    contractStatus: asNullableString(value.contractStatus),
    ...(isProjectLifecycleStatus(value.lifecycleStatus)
      ? { lifecycleStatus: value.lifecycleStatus }
      : {}),
    contractStartDate: asNullableString(value.contractStartDate),
    contractEndDate: asNullableString(value.contractEndDate),
    nestSource,
    createdAt,
    updatedAt,
  };
}

export type NestLookupResponse = {
  notice: string;
  source: "SYNTHETIC_DEMO";
  found: boolean;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  procuringEntity: string | null;
  contractStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
};
