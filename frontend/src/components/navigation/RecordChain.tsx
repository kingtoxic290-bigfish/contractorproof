import { Fragment } from "react";
import { useLocation } from "react-router-dom";
import { cn } from "../../utils/cn";

/**
 * The canonical record chain the platform is built around:
 * Contractor -> Project -> Milestone -> Evidence -> Verification -> Passport.
 *
 * This is a navigation aid only. It shows where the current screen sits in the
 * record chain so users can orient themselves; it asserts nothing about the
 * records themselves and performs no client-side authorization.
 */
const CHAIN = [
  { path: "/contractors", label: "Contractor" },
  { path: "/projects", label: "Project" },
  { path: "/milestones", label: "Milestone" },
  { path: "/evidence", label: "Evidence" },
  { path: "/verification", label: "Verification" },
  { path: "/passports", label: "Passport" },
] as const;

export function currentIndex(pathname: string): number {
  const index = CHAIN.findIndex((step) => pathname === step.path || pathname.startsWith(`${step.path}/`));
  return index;
}

export function RecordChain({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const active = currentIndex(pathname);

  if (active < 0) {
    return null;
  }

  return (
    <nav aria-label="Record chain" className={cn("min-w-0", className)}>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.68rem] font-semibold uppercase tracking-[0.1em]">
        {CHAIN.map((step, index) => {
          const isActive = index === active;
          const isPast = index < active;
          return (
            <Fragment key={step.path}>
              {index > 0 ? (
                <li aria-hidden="true" className="text-[0.65rem] text-stone-300">
                  /
                </li>
              ) : null}
              <li
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "rounded px-1 py-0.5",
                  isActive
                    ? "bg-[#0f3d3a] text-white"
                    : isPast
                      ? "text-stone-600"
                      : "text-stone-400",
                )}
              >
                {step.label}
                {isActive ? <span className="sr-only"> (current stage)</span> : null}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}