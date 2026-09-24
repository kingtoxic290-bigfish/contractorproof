import { asDisplayRecord, fieldLabel, isPlainRecord, scalarText, visibleEntries } from "./query";

export function RecordFields({ record }: { record: object }) {
  const entries = visibleEntries(asDisplayRecord(record)).filter(([, value]) => {
    if (isPlainRecord(value)) {
      return visibleEntries(value).length > 0;
    }
    return scalarText(value) !== null;
  });

  if (entries.length === 0) {
    return <p className="text-sm text-stone-600">This record did not include displayable fields.</p>;
  }

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {entries.map(([key, value]) => (
        <div key={key} className={isPlainRecord(value) ? "min-w-0 sm:col-span-2" : "min-w-0"}>
          <dt className="text-xs uppercase tracking-wide text-stone-500">{fieldLabel(key)}</dt>
          <dd className="mt-1 break-words text-sm text-stone-900">
            {isPlainRecord(value) ? <RecordFields record={value} /> : scalarText(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}
