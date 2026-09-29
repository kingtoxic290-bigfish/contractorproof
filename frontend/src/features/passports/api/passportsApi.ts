import { apiRequest } from "../../../services/api/client";
import {
  parseProjectPassports,
  parseSingleProjectPassport,
  type ProjectPassport,
} from "../types";

export async function getOfficialPassports(): Promise<ProjectPassport[]> {
  const payload = await apiRequest<unknown>("/passports");
  return parseProjectPassports(payload);
}

export async function getOfficialProjectPassport(projectId: string): Promise<ProjectPassport> {
  const payload = await apiRequest<unknown>(`/passports/${encodeURIComponent(projectId)}`);
  return parseSingleProjectPassport(payload);
}