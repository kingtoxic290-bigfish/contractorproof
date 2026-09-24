export function UnavailableModule({
  title,
  endpoint,
  children,
}: {
  title: string;
  endpoint: string;
  children?: string;
}) {
  return (
    <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-3">
      <h3 className="text-sm font-medium text-stone-900">{title}</h3>
      <p className="mt-1 text-sm text-stone-800">Status: Unavailable</p>
      <p className="mt-2 text-sm text-stone-600">
        {children ?? `${endpoint} is not implemented (501). No records are shown.`}
      </p>
    </div>
  );
}
