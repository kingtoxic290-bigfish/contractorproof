import { asDisplayRecord, fieldLabel, isPlainRecord, scalarText, visibleEntries } from "./query";
import { formatDateTime } from "../../utils/format";

/** Field keys whose values are backend timestamps and can be formatted for display. */
const TIMESTAMP_KEYS = new Set(["createdAt", "updatedAt", "verifiedAt", "attestedAt", "reviewedAt"]);

function displayValue(key: string, value: unknown): string | null {
  const text = scalarText(value);
  if (text === null) {
    return null;
  }
  if (TIMESTAMP_KEYS.has(key)) {
    return formatDateTime(text) ?? text;
  }
  return text;
}

/**
 * Renders the fields of a backend record as a labelled definition list.
 *
 * It is a factual dump of what the service returned: no field is invented,
 * renamed or omitted, and nested objects are rendered recursively rather than
 * being flattened into an unreadable string.
 */
export function RecordFields({ record }: { record: object }) {
  const entries = visibleEntries(asDisplayRecord(record)).filter(([, value]) => {
    if (isPlainRecord(value)) {
      return visibleEntries(value).length > 0;
    }
    return scalarText(value) !== null;
  });

  if (entries.length === 0) {
    return (
      <p className="text-sm text-stone-600">This record did not include displayable fields.</p>
    );
  }

  return (
    <dl className="grid gap-4 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div
          key={key}
          className={isPlainRecord(value) ? "min-w-0 sm:col-span-2" : "min-w-0"}
        >
          <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-stone-500">
            {fieldLabel(key)}
          </dt>
          <dd className="mt-1 break-words text-sm text-stone-900">
            {isPlainRecord(value) ? (
              <RecordFields record={value} />
            ) : (
              displayValue(key, value)
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}