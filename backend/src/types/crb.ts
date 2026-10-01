export const CRB_ERROR_CODES = {
  REFERENCE_MISSING: "CRB_REFERENCE_MISSING",
  REFERENCE_INVALID: "CRB_REFERENCE_INVALID",
} as const;

/**
 * Who may read and who may run a CRB registration check.
 *
 * CRB registration is external regulatory information. A contractor may read
 * their own recorded status but may never trigger a check that could be used
 * to manufacture a favourable record, and may never edit a result.
 */
export const CRB_VERIFY_ROLES = [
  "ADMIN",
  "AUDITOR",
  "PROCUREMENT_OFFICER",
  "CONSULTANT_ENGINEER",
  "CLIENT",
] as const;

export const CRB_READ_ROLES = [...CRB_VERIFY_ROLES, "CONTRACTOR"] as const;