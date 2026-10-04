import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { listCorrections } from "../../corrections/api/correctionsApi";
import { listDisputes } from "../../disputes/api/disputesApi";
import { listAttestations } from "../../verification/api/attestationApi";

export type MilestoneWorkflowCounts = {
  /** Client review decisions recorded against this milestone's evidence. */
  approvedAttestations: number;
  rejectedAttestations: number;
  corrections: number;
  openCorrections: number;
  disputes: number;
  openDisputes: number;
};

const ZERO: MilestoneWorkflowCounts = {
  approvedAttestations: 0,
  rejectedAttestations: 0,
  corrections: 0,
  openCorrections: 0,
  disputes: 0,
  openDisputes: 0,
};

/**
 * Factual counts of the review events recorded against one milestone.
 *
 * Every number here is a count of stored records. Nothing is weighted,
 * combined or interpreted, and no total is presented as a quality measure: a
 * milestone with corrections is not "worse" than one without, and a client
 * rejection is a review decision rather than a finding about the contractor.
 */
export function useMilestoneWorkflowCounts(milestoneId: string | undefined) {
  const loader = useCallback(async (): Promise<MilestoneWorkflowCounts> => {
    if (!milestoneId) {
      return ZERO;
    }

    const [attestations, corrections, disputes] = await Promise.all([
      listAttestations({ milestoneId }),
      listCorrections({ milestoneId }),
      listDisputes({ milestoneId }),
    ]);

    return {
      approvedAttestations: attestations.filter((row) => row.decision === "APPROVED").length,
      rejectedAttestations: attestations.filter((row) => row.decision === "REJECTED").length,
      corrections: corrections.length,
      openCorrections: corrections.filter((row) => row.status === "OPEN" || row.status === "UNDER_REVIEW")
        .length,
      disputes: disputes.length,
      openDisputes: disputes.filter((row) => row.status === "OPEN" || row.status === "UNDER_REVIEW")
        .length,
    };
  }, [milestoneId]);

  return useAsyncResource(loader, Boolean(milestoneId));
}
