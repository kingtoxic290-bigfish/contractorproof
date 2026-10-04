import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ContactRound,
  FilePlus2,
  FileCheck,
  FilePenLine,
  Flag,
  FolderKanban,
  Gavel,
  LayoutDashboard,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { Role } from "../../types/roles";
import { CORRECTION_PAGE_ROLES } from "../../features/corrections/types";
import { DISPUTE_PAGE_ROLES } from "../../features/disputes/types";

export type NavItem = {
  to: string;
  label: string;
  hint: string;
  roles?: readonly Role[];
  icon: LucideIcon;
};

export const APP_NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", hint: "Workspace overview", icon: LayoutDashboard },
  { to: "/contractors", label: "Contractors", hint: "Search contractors by CRB Registration Number", roles: ["CLIENT", "ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"], icon: Users },
  { to: "/contractors/me/passport", label: "My Contractor Passport", hint: "Your recorded identity and history", roles: ["CONTRACTOR"], icon: ContactRound },
  { to: "/projects", label: "Projects", hint: "Project records", roles: ["CONTRACTOR", "CLIENT", "ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"], icon: Building2 },
  { to: "/projects/new", label: "Create Project", hint: "Create and assign a project", roles: ["CLIENT", "ADMIN"], icon: FilePlus2 },
  { to: "/milestones", label: "Milestones", hint: "Assigned project milestones", roles: ["CONTRACTOR", "CLIENT", "ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"], icon: Flag },
  { to: "/evidence", label: "Evidence", hint: "Uploaded evidence and hashes", roles: ["CONTRACTOR", "CLIENT", "ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"], icon: FileCheck },
  {
    to: "/verification",
    label: "Verification",
    hint: "Evidence comparison and policy outcomes",
    roles: ["CLIENT", "PROCUREMENT_OFFICER", "AUDITOR", "ADMIN"],
    icon: ShieldCheck,
  },
  { to: "/passports", label: "Project Passports", hint: "Project evidence history", roles: ["CLIENT", "CONTRACTOR", "ADMIN", "AUDITOR", "PROCUREMENT_OFFICER"], icon: FolderKanban },
  { to: "/corrections", label: "Corrections", hint: "Human review corrections", roles: CORRECTION_PAGE_ROLES, icon: FilePenLine },
  { to: "/disputes", label: "Disputes", hint: "Raised disagreements", roles: DISPUTE_PAGE_ROLES, icon: Gavel },
];

export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contractors": "Contractors",
  "/contractors/me/passport": "My Contractor Passport",
  "/projects": "Projects",
  "/projects/new": "Create Project",
  "/milestones": "Milestones",
  "/evidence": "Evidence",
  "/verification": "Verification",
  "/passports": "Project Passports",
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
  return APP_NAV.filter((item) => item.roles?.includes(role)).map((item) => {
    if (item.to === "/projects" && role === "CONTRACTOR") {
      return { ...item, label: "My Assigned Projects", hint: "Projects assigned to you" };
    }
    if (item.to === "/passports" && role === "CONTRACTOR") {
      return { ...item, label: "My Project Passports", hint: "Project records assigned to you" };
    }
    return item;
  });
}

export function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) {
    return PAGE_TITLES[pathname];
  }
  const match = Object.keys(PAGE_TITLES).find((key) => pathname.startsWith(`${key}/`));
  return match ? PAGE_TITLES[match] : "ContractorProof";
}
