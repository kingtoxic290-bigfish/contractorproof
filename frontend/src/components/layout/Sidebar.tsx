import { ShieldCheck } from "lucide-react";
import { RoleAwareNav } from "../navigation/RoleAwareNav";

export function Sidebar() {
  return (
    <aside className="hidden w-72 shrink-0 border-r border-stone-200 bg-stone-50 lg:flex lg:flex-col">
      <div className="border-b border-stone-200 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#0f3d3a]/15 bg-[#0f3d3a]/5 text-[#0f3d3a]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-serif text-xl leading-none text-stone-900">ContractorProof</p>
            <p className="mt-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-stone-500">
              Verification workspace
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <RoleAwareNav />
      </div>
      <p className="border-t border-stone-200 px-5 py-4 text-xs leading-5 text-stone-500">
        Records are supplied by the service. Blockchain anchors evidence integrity; it does not
        validate subjective quality claims.
      </p>
    </aside>
  );
}