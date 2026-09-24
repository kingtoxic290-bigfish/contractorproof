import { useEffect } from "react";
import { RoleAwareNav } from "../navigation/RoleAwareNav";

export function MobileNav({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        className="fixed inset-0 z-30 bg-stone-900/40"
        aria-label="Close navigation"
        onClick={onClose}
      />
      <div
        id="mobile-navigation"
        className="fixed inset-y-0 left-0 z-40 w-80 max-w-[88vw] overflow-y-auto bg-stone-50 p-4 shadow-xl"
      >
        <p className="font-serif text-xl text-stone-900">ContractorProof</p>
        <p className="mt-1 mb-4 text-sm text-stone-600">
          Verifiable Contractor Performance. Trusted Project Evidence.
        </p>
        <RoleAwareNav id="mobile-nav-links" onNavigate={onClose} />
      </div>
    </div>
  );
}
