import { ChevronRight } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { shortIdentifier } from "../../utils/format";
import { cn } from "../../utils/cn";

type Crumb = {
  label: string;
  /** Present when the crumb is a navigation target rather than the current page. */
  to?: string;
  /** Full identifier, kept available even when the visible label is shortened. */
  fullLabel?: string;
};

/**
 * Section names for top-level routes. Record ids are never invented: only
 * segments actually present in the current URL are rendered.
 */
const SECTION_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  contractors: "Contractors",
  projects: "Projects",
  milestones: "Milestones",
  evidence: "Evidence",
  verification: "Verification",
  passports: "Project Passports",
  disputes: "Disputes",
  corrections: "Corrections",
  variations: "Contract variations",
  audit: "Audit trail",
  settings: "Settings",
  forbidden: "Access denied",
};

/** Human label for a record segment, given the record type in the path. */
function recordLabel(segment: string): string {
  return segment.length > 12 ? `Record ${shortIdentifier(segment)}` : segment;
}

export function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return [];
  }

  const [first, second, third] = segments;
  const crumbs: Crumb[] = [
    {
      label: SECTION_LABELS[first] ?? recordLabel(first),
      to: segments.length > 1 ? `/${first}` : undefined,
    },
  ];

  if (segments.length === 1) {
    return crumbs;
  }

  if (first === "projects") {
    if (second === "new") {
      return [...crumbs, { label: "Create project" }];
    }
    crumbs.push({
      label: `Project ${shortIdentifier(second)}`,
      fullLabel: second,
      to: segments.length > 2 ? `/projects/${second}` : undefined,
    });
    if (segments.length > 2) {
      crumbs.push({ label: third === "new" ? "Create milestone" : SECTION_LABELS[third] ?? recordLabel(third) });
    }
    return crumbs;
  }

  if (first === "contractors") {
    crumbs.push({ label: `Contractor ${shortIdentifier(second)}`, fullLabel: second });
    return crumbs;
  }

  if (first === "milestones") {
    crumbs.push({ label: `Milestone ${shortIdentifier(second)}`, fullLabel: second });
    return crumbs;
  }

  if (first === "passports") {
    crumbs.push({ label: `Passport ${shortIdentifier(second)}`, fullLabel: second });
    return crumbs;
  }

  return crumbs;
}

/**
 * Route-derived breadcrumb trail.
 *
 * It is derived entirely from the current URL, so it can never show a record
 * that was not actually opened, and it introduces no client-side authorization
 * decision.
 */
export function Breadcrumbs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const crumbs = buildCrumbs(pathname);

  if (crumbs.length < 2) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs text-stone-500">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={`${crumb.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              ) : null}
              {crumb.to && !isLast ? (
                <Link
                  to={crumb.to}
                  title={crumb.fullLabel ?? crumb.label}
                  className="rounded font-medium text-stone-600 underline underline-offset-2 hover:text-[#0f3d3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? "page" : undefined}
                  title={crumb.fullLabel ?? crumb.label}
                  className={cn(
                    "truncate rounded font-semibold",
                    isLast ? "text-stone-900" : "text-stone-600",
                  )}
                >
                  {crumb.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}