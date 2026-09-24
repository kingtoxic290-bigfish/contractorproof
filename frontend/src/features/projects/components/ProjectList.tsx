import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { RecordFields } from "../../shared/RecordFields";
import { StateLabel } from "../../shared/StateLabel";
import type { PublicProject } from "../types";

export function ProjectList({ records }: { records: PublicProject[] }) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => (
        <li key={record.id}>
          <Card>
            {record.contractStatus ? (
              <p className="mb-3">
                <StateLabel value={record.contractStatus} />
              </p>
            ) : null}
            <RecordFields record={record} />
            <p className="mt-4">
              <Link
                to={`/projects/${encodeURIComponent(record.id)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View project
              </Link>
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
