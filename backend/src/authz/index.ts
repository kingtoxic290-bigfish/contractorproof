/**
 * Canonical Agent 6 authorization surface.
 * Ownership implementations live in access.service.ts so Agent 2 imports keep working.
 */
export { authenticate } from "../middleware/authenticate";
export { authorize, requireRole } from "../middleware/authorize";
export { requirePermission, PERMISSIONS } from "./permissions";
export {
  assertCanAccessEvidence,
  assertCanAccessMilestone,
  assertCanAccessProject,
  assertCanAccessVerificationTarget,
  assertCanCreateVerification,
  assertCanReadContractor,
  assertCanReadEvidence,
  assertCanReadMilestone,
  assertCanReadProject,
  assertCanReadVersion,
  contractorListWhere,
  projectListWhere,
  assertCanWriteEvidence,
  assertCanWriteMilestone,
  assertCanWriteProject,
  assertOwnership,
  evidenceListWhere,
  disputeListWhere,
  correctionListWhere,
  attestationListWhere,
} from "../services/access.service";
export { assertCanAttest } from "../services/attestation.service";
