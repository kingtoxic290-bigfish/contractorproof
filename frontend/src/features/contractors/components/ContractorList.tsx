import { Link } from "react-router-dom";
import { ContractorSummary } from "./ContractorSummary";
import type { PublicContractor } from "../types";

export function ContractorList({ records }: { records: PublicContractor[] }) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => (
        <li key={record.id}>
          <ContractorSummary
            contractor={record}
            actions={
              <>
                <Link
                  to={`/contractors/${encodeURIComponent(record.id)}`}
                  className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  View contractor
                </Link>
                <Link
                  to={`/contractors/${encodeURIComponent(record.id)}/passport`}
                  className="text-sm font-semibold text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                >
                  Open Contractor Passport
                </Link>
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}
