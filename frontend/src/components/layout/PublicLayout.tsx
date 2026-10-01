import { ShieldCheck } from "lucide-react";
import { Link, Outlet } from "react-router-dom";
import { PageContainer } from "../ui/PageContainer";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <PageContainer className="flex max-w-4xl items-center justify-between gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#0f3d3a]/10 bg-[#0f3d3a]/5 text-[#0f3d3a]">
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="font-serif text-xl leading-none text-stone-900">ContractorProof</p>
              <p className="mt-1 text-xs text-stone-500">
                Evidence verification · Blockchain integrity layer
              </p>
            </div>
          </div>
          <Link
            to="/verify"
            className="text-sm font-medium text-teal-900 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
          >
            Public verification
          </Link>
        </PageContainer>
      </header>
      <PageContainer className="max-w-4xl py-8">
        <Outlet />
      </PageContainer>
    </div>
  );
}
