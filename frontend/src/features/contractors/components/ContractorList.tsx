import { Link } from "react-router-dom";
import { Card } from "../../../components/ui/Card";
import { RecordFields } from "../../shared/RecordFields";
import type { PublicContractor } from "../types";

export function ContractorList({ records }: { records: PublicContractor[] }) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => (
        <li key={record.id}>
          <Card>
            <RecordFields record={record} />
            <p className="mt-4">
              <Link
                to={`/contractors/${encodeURIComponent(record.id)}`}
                className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
              >
                View contractor
              </Link>
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
