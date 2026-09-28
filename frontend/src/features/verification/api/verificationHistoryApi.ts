import { loadDashboard } from "../../../pages/dashboardApi";
import type {
  DashboardProof,
  DashboardProjectPassport,
  DashboardVerification,
} from "../../../pages/dashboard.types";

export type VerificationHistoryEntry = {
  verification: DashboardVerification;
  projectId: string;
  projectName: string;
  milestoneId: string;
  milestoneName: string;
  evidenceId: string;
  evidenceVersionId: string;
  versionNumber: number;
  sha256: string;
  proof: DashboardProof | null;
};

export async function listVerificationHistory(): Promise<VerificationHistoryEntry[]> {
  const passports = await loadDashboard();
  return passports.flatMap(projectPassportHistory);
}

function projectPassportHistory(passport: DashboardProjectPassport): VerificationHistoryEntry[] {
  return passport.milestones.flatMap((milestone) =>
    milestone.evidence.flatMap((evidence) =>
      evidence.versions.flatMap((version) =>
        version.verifications.map((verification) => ({
          verification,
          projectId: passport.project.id,
          projectName: passport.project.name,
          milestoneId: milestone.id,
          milestoneName: milestone.name,
          evidenceId: evidence.id,
          evidenceVersionId: version.id,
          versionNumber: version.versionNumber,
          sha256: version.sha256,
          proof:
            passport.blockchainProofs.find(
              (event) => event.eventType === "VERIFICATION" && event.referenceId === version.id,
            ) ?? null,
        })),
      ),
    ),
  );
}