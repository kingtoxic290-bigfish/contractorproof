export const ROLES = [
  "CONTRACTOR",
  "CLIENT",
  "CONSULTANT_ENGINEER",
  "PROCUREMENT_OFFICER",
  "AUDITOR",
  "ADMIN",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  CONTRACTOR: "Contractor",
  CLIENT: "Client",
  CONSULTANT_ENGINEER: "Consultant engineer",
  PROCUREMENT_OFFICER: "Procurement officer",
  AUDITOR: "Auditor",
  ADMIN: "Administrator",
};

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}
