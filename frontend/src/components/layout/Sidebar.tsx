import { RoleAwareNav } from "../navigation/RoleAwareNav";

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-stone-200 bg-stone-50 lg:flex lg:flex-col">
      <div className="border-b border-stone-200 px-5 py-5">
        <p className="font-serif text-2xl text-stone-900">ContractorProof</p>
        <p className="mt-2 text-sm leading-5 text-stone-600">
          Verifiable Contractor Performance. Trusted Project Evidence.
        </p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <RoleAwareNav />
      </div>
      <p className="border-t border-stone-200 px-5 py-4 text-xs leading-5 text-stone-500">
        Blockchain records evidence integrity. It does not prove that a construction claim is true.
      </p>
    </aside>
  );
}
