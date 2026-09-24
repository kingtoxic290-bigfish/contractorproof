import type { Role } from "../../types/roles";

export type NavItem = {
  to: string;
  label: string;
  hint: string;
  roles?: Role[];
};

export const APP_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", hint: "Overview of your workspace" },
  { to: "/contractors", label: "Contractors", hint: "Registered contractor records" },
  { to: "/projects", label: "Projects", hint: "Projects and institutional references" },
  { to: "/milestones", label: "Milestones", hint: "Project milestone records" },
  { to: "/evidence", label: "Evidence", hint: "Uploaded evidence and fingerprints" },
  {
    to: "/verification",
    label: "Verification",
    hint: "Fingerprint comparison and attestations",
    roles: ["CONSULTANT_ENGINEER", "CLIENT", "PROCUREMENT_OFFICER", "AUDITOR", "ADMIN"],
  },
  { to: "/passports", label: "Performance passports", hint: "Recorded project event passports" },
  { to: "/disputes", label: "Disputes", hint: "Open and resolved disputes" },
  { to: "/corrections", label: "Corrections", hint: "Append-only correction events" },
  { to: "/variations", label: "Variations", hint: "Linked contract variations" },
  {
    to: "/audit",
    label: "Audit trail",
    hint: "System and event audit records",
    roles: ["AUDITOR", "ADMIN", "PROCUREMENT_OFFICER"],
  },
  { to: "/settings", label: "Settings", hint: "Account and workspace settings" },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contractors": "Contractors",
  "/projects": "Projects",
  "/milestones": "Milestones",
  "/evidence": "Evidence",
  "/verification": "Verification",
  "/passports": "Performance passports",
  "/disputes": "Disputes",
  "/corrections": "Corrections",
  "/variations": "Variations",
  "/audit": "Audit trail",
  "/settings": "Settings",
  "/forbidden": "Access denied",
};

export function visibleNavItems(role: Role | undefined): NavItem[] {
  if (!role) {
    return [];
  }
  return APP_NAV.filter((item) => !item.roles || item.roles.includes(role));
}

export function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  const match = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(`${key}/`));
  return match ? PAGE_TITLES[match] : "ContractorProof";
}
