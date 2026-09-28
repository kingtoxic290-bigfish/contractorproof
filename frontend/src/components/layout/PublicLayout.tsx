import { Outlet } from "react-router-dom";
import { PageContainer } from "../ui/PageContainer";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <PageContainer className="flex max-w-4xl flex-col gap-1 py-5">
          <p className="font-serif text-2xl text-stone-900">ContractorProof</p>
          <p className="text-sm text-stone-600">
            Evidence-backed project verification and professional record review.
          </p>
        </PageContainer>
      </header>
      <PageContainer className="max-w-4xl py-8">
        <Outlet />
      </PageContainer>
    </div>
  );
}
