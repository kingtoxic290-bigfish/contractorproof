import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { roleLabel } from "../../types/roles";
import { pageTitle } from "../navigation/navConfig";
import { Button } from "../ui/Button";

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
      <div className="flex items-center justify-between gap-4 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="rounded-md border border-stone-300 px-2.5 py-1.5 text-sm font-medium text-stone-800 lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            onClick={onToggleMenu}
          >
            {menuOpen ? "Close menu" : "Open menu"}
          </button>
          <div className="min-w-0">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-stone-500">ContractorProof</p>
            <p className="truncate font-serif text-xl text-stone-900">{title}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
