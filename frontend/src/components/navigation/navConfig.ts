import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardCheck,
  FileCheck,
  FilePenLine,
  Flag,
  FolderKanban,
  GitBranch,
  LayoutDashboard,
  Scale,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Role } from "../../types/roles";

export type NavItem = {
  to: string;
  label: string;
  hint: string;
  roles?: Role[];
  icon: LucideIcon;
};

export const APP_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", hint: "Workspace overview", icon: LayoutDashboard },
  { to: "/contractors", label: "Contractors", hint: "Registered contractor records", icon: Users },
  { to: "/projects", label: "Projects", hint: "Project and milestone references", icon: Building2 },
  { to: "/milestones", label: "Milestones", hint: "Project milestone records", icon: Flag },
  { to: "/evidence", label: "Evidence", hint: "Uploaded evidence and hashes", icon: FileCheck },
  {
    to: "/verification",
    label: "Verification",
    hint: "Evidence comparison and policy outcomes",
    roles: ["CONSULTANT_ENGINEER", "CLIENT", "PROCUREMENT_OFFICER", "AUDITOR", "ADMIN"],
    icon: ShieldCheck,
  },
  { to: "/passports", label: "Passport", hint: "Project evidence history", icon: FolderKanban },
  { to: "/disputes", label: "Disputes", hint: "Open and resolved disputes", icon: Scale },
  { to: "/corrections", label: "Corrections", hint: "Append-only correction events", icon: FilePenLine },
  { to: "/variations", label: "Variations", hint: "Linked contract variations", icon: GitBranch },
  {
    to: "/audit",
    label: "Audit trail",
    hint: "System and event audit records",
    roles: ["AUDITOR", "ADMIN", "PROCUREMENT_OFFICER"],
    icon: ClipboardCheck,
  },
  { to: "/settings", label: "Settings", hint: "Account and workspace settings", icon: Settings2 },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contractors": "Contractors",
  "/projects": "Projects",
  "/milestones": "Milestones",
  "/evidence": "Evidence",
  "/verification": "Verification",
  "/passports": "Contractor Passports",
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
