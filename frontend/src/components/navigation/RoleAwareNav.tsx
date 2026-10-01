import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/cn";
import { visibleNavItems } from "./navConfig";

/**
 * Role-aware primary navigation.
 *
 * The visible items are filtered by role for usability only; the service remains
 * authoritative and every screen it does not permit is refused server-side. The
 * active route is marked with colour, weight and an icon fill so it is obvious
 * without relying on colour alone.
 */
export function RoleAwareNav({
  onNavigate,
  id,
}: {
  onNavigate?: () => void;
  id?: string;
}) {
  const { user } = useAuth();
  const items = visibleNavItems(user?.role);

  return (
    <nav id={id} aria-label="Application" className="flex flex-col gap-1">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              "group flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]",
              isActive
                ? "border-[#0f3d3a] bg-[#0f3d3a] text-white"
                : "border-transparent text-stone-700 hover:border-stone-200 hover:bg-stone-100",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border",
                  isActive
                    ? "border-white/25 bg-white/10 text-white"
                    : "border-stone-200 bg-stone-100 text-stone-700 group-hover:border-stone-300 group-hover:bg-stone-200",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                <span
                  className={cn(
                    "block text-xs",
                    isActive ? "text-stone-200" : "text-stone-500",
                  )}
                >
                  {item.hint}
                </span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}