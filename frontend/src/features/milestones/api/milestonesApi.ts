import { apiRequest } from "../../../services/api/client";
import { unwrapNamedList } from "../../shared/query";
import { parsePublicMilestone, type PublicMilestone } from "../types";

export async function listProjectMilestones(projectId: string): Promise<PublicMilestone[]> {
  const payload = await apiRequest<unknown>(`/projects/${projectId}/milestones`);
  const records = unwrapNamedList(payload, "milestones");
  if (!records) {
    throw new Error("The milestone list response is not in a known format.");
  }

  const milestones = records
    .map(parsePublicMilestone)
    .filter((record): record is PublicMilestone => record !== null);
  if (milestones.length !== records.length) {
    throw new Error("The milestone list response is not in a known format.");
  }
  return milestones;
}
