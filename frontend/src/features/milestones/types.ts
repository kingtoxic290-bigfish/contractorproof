import { asNullableString, asRequiredString, isPlainRecord } from "../shared/query";

export type PublicMilestone = {
  id: string;
  projectId: string;
  policyId: string | null;
  name: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function parsePublicMilestone(value: unknown): PublicMilestone | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const projectId = asRequiredString(value.projectId);
  const name = asRequiredString(value.name);
  const status = asRequiredString(value.status);
  const createdAt = asRequiredString(value.createdAt);
  const updatedAt = asRequiredString(value.updatedAt);
  if (!id || !projectId || !name || !status || !createdAt || !updatedAt) {
    return null;
  }

  return {
    id,
    projectId,
    policyId: asNullableString(value.policyId),
    name,
    description: asNullableString(value.description),
    status,
    createdAt,
    updatedAt,
  };
}
