import type { ReactNode } from "react";
import { cn } from "../../utils/cn";

export function DataTable({
  headers,
  rows,
  className,
  emptyMessage,
}: {
  headers: string[];
  rows: ReactNode[][];
  className?: string;
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-sm text-stone-600">
        {emptyMessage ?? "No records are available."}
      </div>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="min-w-full border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-stone-600"
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
