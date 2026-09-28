import type { Role } from "@prisma/client";
import { authorize } from "../middleware/authorize";

export const PERMISSIONS = {
  PROJECT_WRITE: ["CONTRACTOR", "ADMIN"],
  MILESTONE_WRITE: ["CONTRACTOR", "ADMIN"],
  EVIDENCE_UPLOAD: ["CONTRACTOR", "ADMIN"],
  EVIDENCE_READ: [
    "ADMIN",
    "AUDITOR",
    "PROCUREMENT_OFFICER",
    "CONTRACTOR",
    "CONSULTANT_ENGINEER",
    "CLIENT",
  ],
  VERIFY_INTERNAL: [
    "ADMIN",
    "AUDITOR",
    "PROCUREMENT_OFFICER",
    "CONSULTANT_ENGINEER",
    "CLIENT",
  ],
  ATTEST: ["CONSULTANT_ENGINEER", "CLIENT", "PROCUREMENT_OFFICER", "AUDITOR", "ADMIN"],
  DISPUTE_CREATE: ["CONTRACTOR", "ADMIN", "CLIENT", "CONSULTANT_ENGINEER"],
  DISPUTE_READ: [
    "ADMIN",
    "AUDITOR",
    "PROCUREMENT_OFFICER",
    "CONTRACTOR",
    "CONSULTANT_ENGINEER",
    "CLIENT",
  ],
  DISPUTE_RESOLVE: ["ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"],
  CORRECTION_CREATE: ["CONTRACTOR", "ADMIN", "CLIENT", "CONSULTANT_ENGINEER"],
  CORRECTION_READ: [
    "ADMIN",
    "AUDITOR",
    "PROCUREMENT_OFFICER",
    "CONTRACTOR",
    "CONSULTANT_ENGINEER",
    "CLIENT",
  ],
  PROVISION_USERS: ["ADMIN"],
  AUDIT_READ: ["AUDITOR", "ADMIN", "PROCUREMENT_OFFICER"],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function requirePermission(permission: Permission) {
  return authorize(...PERMISSIONS[permission]);
}
