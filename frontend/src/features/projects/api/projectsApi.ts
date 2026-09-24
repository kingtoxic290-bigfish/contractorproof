import { apiRequest } from "../../../services/api/client";
import { unwrapNamedList, unwrapNamedRecord } from "../../shared/query";
import { parsePublicProject, type PublicProject } from "../types";

export async function listProjects(): Promise<PublicProject[]> {
  const payload = await apiRequest<unknown>("/projects");
  const records = unwrapNamedList(payload, "projects");
  if (!records) {
    throw new Error("The project list response is not in a known format.");
  }

  const projects = records
    .map(parsePublicProject)
    .filter((record): record is PublicProject => record !== null);
  if (projects.length !== records.length) {
    throw new Error("The project list response is not in a known format.");
  }
  return projects;
}

export async function getProject(projectId: string): Promise<PublicProject> {
  const payload = await apiRequest<unknown>(`/projects/${projectId}`);
  const record = unwrapNamedRecord(payload, "project");
  const project = record ? parsePublicProject(record) : null;
  if (!project) {
    throw new Error("The project response is not in a known format.");
  }
  return project;
}
