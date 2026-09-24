import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { RecordFields } from "../../shared/RecordFields";
import { StateLabel } from "../../shared/StateLabel";
import type { PublicMilestone } from "../types";

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
        const associatedProject = record.projectId || projectId;
        return (
          <li key={record.id}>
            <Card>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <StateLabel value={record.status} />
                {associatedProject ? (
                  <span className="text-xs text-stone-500">Project {associatedProject}</span>
                ) : null}
              </div>
              <RecordFields record={record} />
              <p className="mt-4">
                <Link
                  to={`/evidence?milestoneId=${encodeURIComponent(record.id)}`}
                  className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  View milestone evidence
                </Link>
              </p>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
