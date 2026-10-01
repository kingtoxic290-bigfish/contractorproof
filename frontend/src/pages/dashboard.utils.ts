import {
  VERIFICATION_STATES,
  type DashboardProjectPassport,
  type VerificationState,
} from "./dashboard.types";

export type DashboardActivity = {
  id: string;
  projectId: string;
  at: string;
  label: string;
  detail: string;
};

export type DashboardAttention = {
  id: string;
  projectId: string;
  evidenceId: string;
  status: VerificationState;
};

export function getDashboardSummary(passports: DashboardProjectPassport[]) {
  const milestones = passports.flatMap((passport) => passport.milestones);
  const evidence = milestones.flatMap((milestone) => milestone.evidence);
  const verifications = evidence.flatMap((record) =>
    record.versions.flatMap((version) => version.verifications),
  );
  const verificationCounts = Object.fromEntries(
    VERIFICATION_STATES.map((status) => [status, 0]),
  ) as Record<VerificationState, number>;

  for (const verification of verifications) {
    verificationCounts[verification.status] += 1;
  }

  const proofs = passports.flatMap((passport) => passport.blockchainProofs);
  return {
    projectCount: passports.length,
    activeProjectCount: passports.filter((passport) => passport.project.contractStatus === "ACTIVE").length,
    milestoneCount: milestones.length,
    inProgressMilestoneCount: milestones.filter((milestone) => milestone.status === "IN_PROGRESS").length,
    evidenceCount: evidence.length,
    pendingEvidenceCount: evidence.filter((record) => record.status === "PENDING_VERIFICATION").length,
    verificationCount: verifications.length,
    verificationCounts,
    confirmedProofCount: proofs.filter((proof) => proof.confirmed).length,
    pendingProofCount: proofs.filter((proof) => !proof.confirmed).length,
    projectsWithoutProof: passports.filter((passport) => passport.blockchainProofs.length === 0).length,
    attestations: evidence.flatMap((record) => record.attestations),
  };
}

function isUsableDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

export function getRecentActivity(
  passports: DashboardProjectPassport[],
  limit = 8,
): DashboardActivity[] {
  const activities: DashboardActivity[] = [];

  for (const passport of passports) {
    const project = passport.project;
    activities.push({
      id: `project-${project.id}`,
      projectId: project.id,
      at: project.createdAt,
      label: "Project created",
      detail: project.name,
    });

    for (const milestone of passport.milestones) {
      activities.push({
        id: `milestone-${milestone.id}`,
        projectId: project.id,
        at: milestone.createdAt,
        label: "Milestone created",
        detail: milestone.name,
      });

      for (const evidence of milestone.evidence) {
        activities.push({
          id: `evidence-${evidence.id}`,
          projectId: project.id,
          at: evidence.createdAt,
          label: "Evidence record created",
          detail: `Evidence ${evidence.id}`,
        });
        for (const version of evidence.versions) {
          for (const verification of version.verifications) {
            activities.push({
              id: `verification-${verification.id}`,
              projectId: project.id,
              at: verification.createdAt,
              label: `Verification ${verification.status}`,
              detail: `Evidence ${evidence.id}`,
            });
          }
        }
        for (const attestation of evidence.attestations) {
          activities.push({
            id: `attestation-${attestation.id}`,
            projectId: project.id,
            at: attestation.createdAt,
            label: `Attestation ${attestation.decision}`,
            detail: `Evidence ${evidence.id}`,
          });
        }
      }
    }

    for (const proof of passport.blockchainProofs) {
      activities.push({
        id: `proof-${proof.id}`,
        projectId: project.id,
        at: proof.createdAt,
        label: `Blockchain proof ${proof.confirmed ? "confirmed" : "pending"}`,
        detail: proof.eventType,
      });
    }
  }

  return activities
    .filter((activity) => isUsableDate(activity.at))
    .sort((left, right) => Date.parse(right.at) - Date.parse(left.at))
    .slice(0, limit);
}

export function getDashboardAttention(passports: DashboardProjectPassport[]): DashboardAttention[] {
  return passports.flatMap((passport) =>
    passport.milestones.flatMap((milestone) =>
      milestone.evidence.flatMap((evidence) =>
        evidence.versions.flatMap((version) =>
          version.verifications
            .filter((verification) =>
              verification.status === "MISMATCH" ||
              verification.status === "PENDING" ||
              verification.status === "UNAVAILABLE",
            )
            .map((verification) => ({
              id: verification.id,
              projectId: passport.project.id,
              evidenceId: evidence.id,
              status: verification.status,
            })),
        ),
      ),
    ),
  );
}

export function formatDashboardDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Timestamp unavailable";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}