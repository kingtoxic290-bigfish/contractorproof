import type { PublicContractor } from "../contractors/types";
import type { PublicEvidence } from "../evidence/types";
import type { PublicMilestone } from "../milestones/types";
import type { PublicProject } from "../projects/types";

export type ProjectHistory = {
  project: PublicProject;
  milestones: PublicMilestone[];
  evidence: PublicEvidence[];
};

export type ContractorHistory = {
  contractor: PublicContractor;
  projects: ProjectHistory[];
};

export type TimelineEvent = {
  at: string;
  kind: "contractor" | "project" | "milestone" | "evidence";
  label: string;
  detail: string;
};

export const INTEGRITY_EXPLANATION: Record<string, string> = {
  MATCH: "Evidence fingerprint matches the recorded integrity value.",
  MISMATCH: "Evidence fingerprint does not match the recorded integrity value.",
  PENDING: "Verification is pending.",
  UNAVAILABLE: "Verification result is currently unavailable.",
};

export function integrityExplanation(status: string): string | null {
  return INTEGRITY_EXPLANATION[status] ?? null;
}

export function buildTimeline(history: ContractorHistory): TimelineEvent[] {
  const events: TimelineEvent[] = [
    {
      at: history.contractor.createdAt,
      kind: "contractor",
      label: "Contractor record created",
      detail: history.contractor.legalName,
    },
  ];

  for (const entry of history.projects) {
    events.push({
      at: entry.project.createdAt,
      kind: "project",
      label: "Project registered",
      detail: entry.project.name,
    });
    for (const milestone of entry.milestones) {
      events.push({
        at: milestone.createdAt,
        kind: "milestone",
        label: "Milestone recorded",
        detail: milestone.name,
      });
    }
    for (const evidence of entry.evidence) {
      events.push({
        at: evidence.createdAt,
        kind: "evidence",
        label: "Evidence uploaded",
        detail: evidence.fileName,
      });
    }
  }

  return events.sort((left, right) => left.at.localeCompare(right.at));
}
