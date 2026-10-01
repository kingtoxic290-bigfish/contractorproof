import { Link } from "react-router-dom";
import { ArrowRight, FileCheck2 } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { RecordFields } from "../../shared/RecordFields";
import { StateLabel } from "../../shared/StateLabel";
import type { PublicMilestone } from "../types";

/**
 * Lists the milestones of a project.
 *
 * Each card states the project the milestone belongs to, then the milestone
 * itself, then a direct route to that milestone's evidence, so the
 * PROJECT -> MILESTONE -> EVIDENCE relationship is visible without guesswork.
 */
export function MilestoneList({
  records,
  projectId,
}: {
  records: PublicMilestone[];
  projectId?: string;
}) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => {
        const { name, projectId: recordProjectId, status, ...details } = record;
        const associatedProject = recordProjectId || projectId;
        return (
          <li key={record.id}>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {associatedProject ? (
                    <p className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
                      Project {associatedProject}
                    </p>
                  ) : null}
                  <h3 className="mt-1 font-serif text-lg leading-snug text-stone-900">
                    <Link
                      to={`/milestones/${encodeURIComponent(record.id)}`}
                      className="underline decoration-stone-300 underline-offset-4 hover:text-[#0f3d3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                    >
                      {name}
                    </Link>
                  </h3>
                  <p className="mt-2">
                    <StateLabel value={status} />
                  </p>
                </div>
                <Link
                  to={`/milestones/${encodeURIComponent(record.id)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                >
                  View milestone
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              {Object.keys(details).length > 0 ? (
                <div className="mt-4 border-t border-stone-200 pt-4">
                  <RecordFields record={details} />
                </div>
              ) : null}

              <nav
                aria-label={`Links for milestone ${name}`}
                className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm"
              >
                <Link
                  to={`/evidence?milestoneId=${encodeURIComponent(record.id)}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                >
                  <FileCheck2 className="h-4 w-4" aria-hidden="true" />
                  Evidence for this milestone
                </Link>
                {associatedProject ? (
                  <Link
                    to={`/projects/${encodeURIComponent(associatedProject)}`}
                    className="font-semibold text-[#0f3d3a] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                  >
                    Project this milestone belongs to
                  </Link>
                ) : null}
              </nav>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
