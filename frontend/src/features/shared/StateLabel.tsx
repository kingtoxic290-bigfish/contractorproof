export function StateLabel({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-800">
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
      <span>{value}</span>
    </span>
  );
}
