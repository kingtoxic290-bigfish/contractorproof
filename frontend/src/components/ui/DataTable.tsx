import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

/**
 * Standard record table.
 *
 * Uses `caption` and `scope` so screen readers can navigate it, and wraps the
 * table in a horizontally scrollable region so wide data scrolls instead of
 * forcing the whole page to overflow on small screens.
 */
export function DataTable({
  headers,
  rows,
  className,
  emptyMessage,
  caption,
}: {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
  emptyMessage?: string;
  caption?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-600">
        {emptyMessage ?? "The service returned no records."}
      </div>
    );
  }

  return (
    <div className={cn("max-w-full overflow-x-auto", className)}>
      <table className="w-full min-w-full border-separate border-spacing-0 text-left text-sm">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="whitespace-nowrap border-b border-stone-300 bg-stone-50 px-3 py-2.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-600"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="align-top">
              {row.map((cell, cellIndex) => (
                <td
                  key={`${rowIndex}-${cellIndex}`}
                  className="border-b border-stone-200 px-3 py-3 text-stone-700"
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}