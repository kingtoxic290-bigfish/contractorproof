import { NavLink } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { cn } from "../../utils/cn";
import { visibleNavItems } from "./navConfig";

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
              "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800",
              isActive
                ? "border-teal-900 bg-teal-900 text-white shadow-sm"
                : "border-transparent bg-transparent text-stone-700 hover:border-stone-200 hover:bg-stone-100",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border",
                  isActive
                    ? "border-white/20 bg-white/10 text-white"
                    : "border-stone-200 bg-stone-100 text-stone-700 group-hover:border-stone-300 group-hover:bg-stone-200",
                )}
              >
                <item.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{item.label}</span>
                <span className={cn("block text-xs", isActive ? "text-teal-50" : "text-stone-500")}>{item.hint}</span>
              </span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
