import { useLocation, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { roleLabel } from "../../types/roles";
import { pageTitle } from "../navigation/navConfig";
import { Button } from "../ui/Button";

/**
 * Global header. It identifies the current section and the signed-in account,
 * and hosts the mobile navigation toggle. The page's own `h1` remains the
 * document heading, so this is context rather than a second title.
 */
export function Header({
  menuOpen,
  onToggleMenu,
}: {
  menuOpen: boolean;
  onToggleMenu: () => void;
}) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitle(location.pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-stone-300 bg-white text-stone-800 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
            onClick={onToggleMenu}
          >
            {menuOpen ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Menu className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-stone-500">
              ContractorProof
            </p>
            <p className="truncate font-serif text-lg leading-tight text-stone-900">{title}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {user ? (
            <div className="hidden text-right sm:block">
              <p className="text-sm font-semibold text-stone-900">{user.fullName}</p>
              <p className="text-xs text-stone-500">{roleLabel(user.role)}</p>
            </div>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Log out
          </Button>
        </div>
      </div>
    </header>
  );
}