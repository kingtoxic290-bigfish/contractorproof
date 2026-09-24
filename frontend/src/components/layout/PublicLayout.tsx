import { Outlet } from "react-router-dom";

export function PublicLayout() {
  return (
    <div className="min-h-screen bg-stone-100">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 py-5">
          <p className="font-serif text-2xl text-stone-900">ContractorProof</p>
          <p className="text-sm text-stone-600">
            Verifiable Contractor Performance. Trusted Project Evidence.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
