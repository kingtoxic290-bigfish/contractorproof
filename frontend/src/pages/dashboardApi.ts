import { apiRequest } from "../services/api/client";
import { parseDashboardPassports, type DashboardProjectPassport } from "./dashboard.types";

export async function loadDashboard(): Promise<DashboardProjectPassport[]> {
  const payload = await apiRequest<unknown>("/passports");
  return parseDashboardPassports(payload);
}