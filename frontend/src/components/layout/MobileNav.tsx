import { useEffect } from "react";
import { X } from "lucide-react";
import { RoleAwareNav } from "../navigation/RoleAwareNav";

/**
 * Mobile navigation drawer. Mirrors the desktop sidebar and closes on Escape or
 * on selection. It is rendered only while open, so it adds no layout on small
 * screens.
 */
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
        role="dialog"
        aria-modal="true"
        aria-label="Application navigation"
        className="fixed inset-y-0 left-0 z-40 w-80 max-w-[88vw] overflow-y-auto bg-stone-50 p-4 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-serif text-lg leading-tight text-stone-900">ContractorProof</p>
            <p className="mt-1 text-xs text-stone-600">Verification workspace</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <RoleAwareNav id="mobile-nav-links" onNavigate={onClose} />
      </div>
    </div>
  );
}