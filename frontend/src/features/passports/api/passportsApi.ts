import { apiRequest } from "../../../services/api/client";
import { getContractor } from "../../contractors/api/contractorsApi";
import { listEvidence } from "../../evidence/api/evidenceApi";
import { listProjectMilestones } from "../../milestones/api/milestonesApi";
import { listProjects } from "../../projects/api/projectsApi";
import type { ContractorHistory } from "../types";

/**
 * Official derived projection. Current backend: GET /api/v1/passports → 501.
 * A 200 body is not documented as implemented, so success is rejected.
 */
export async function getOfficialPassports(): Promise<never> {
  await apiRequest<unknown>("/passports");
  throw new Error("The passport projection response is not in a known format.");
}

/**
 * Official per-project projection. Current backend: GET /api/v1/passports/:projectId → 501.
 */
export async function getOfficialProjectPassport(projectId: string): Promise<never> {
  await apiRequest<unknown>(`/passports/${projectId}`);
  throw new Error("The passport projection response is not in a known format.");
}

/**
 * Contractor project history composed from implemented GET APIs only.
 * GET /passports is not used. Verification POST, attestation POST, and
 * blockchain GET are not called — those writes/lists are not a passport read.
 */
export async function loadContractorHistory(contractorId: string): Promise<ContractorHistory> {
  const [contractor, projects] = await Promise.all([getContractor(contractorId), listProjects()]);
  const owned = projects.filter((project) => project.contractorId === contractorId);

  const histories = await Promise.all(
    owned.map(async (project) => {
      const [milestones, evidence] = await Promise.all([
        listProjectMilestones(project.id),
        listEvidence({ projectId: project.id }),
      ]);
      return { project, milestones, evidence };
    }),
  );

  return { contractor, projects: histories };
}
