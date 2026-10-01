import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import { Field, FieldGrid } from "../../../components/ui/Field";
import { RecordFields } from "../../shared/RecordFields";
import { StateLabel } from "../../shared/StateLabel";
import type { PublicProject } from "../types";

/**
 * Lists the projects accessible to the signed-in account.
 *
 * The record name is the heading, the contract status is shown as an explicit
 * state chip, and the project identifier is shown in full but in a wrapping
 * monospace style so it is readable without forcing horizontal overflow.
 */
export function ProjectList({ records }: { records: PublicProject[] }) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => {
        const { id, name, contractStatus, ...details } = record;
        return (
          <li key={id}>
            <Card>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-serif text-lg leading-snug text-stone-900">
                    <Link
                      to={`/projects/${encodeURIComponent(id)}`}
                      className="underline decoration-stone-300 underline-offset-4 hover:text-[#0f3d3a] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                    >
                      {name}
                    </Link>
                  </h3>
                  {contractStatus ? (
                    <p className="mt-2">
                      <StateLabel value={contractStatus} />
                    </p>
                  ) : null}
                </div>
                <Link
                  to={`/projects/${encodeURIComponent(id)}`}
                  className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-stone-800 transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
                >
                  View project
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>

              <FieldGrid className="mt-4 border-t border-stone-200 pt-4">
                <Field label="Project ID" mono className="sm:col-span-2">
                  {id}
                </Field>
              </FieldGrid>

              {Object.keys(details).length > 0 ? (
                <div className="mt-4">
                  <RecordFields record={details} />
                </div>
              ) : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}