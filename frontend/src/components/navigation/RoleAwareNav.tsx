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
              "rounded-md px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800",
              isActive
                ? "bg-teal-900 text-white"
                : "text-stone-700 hover:bg-stone-100",
            )
          }
        >
          <span className="block font-medium">{item.label}</span>
          <span className={cn("block text-xs", "opacity-80")}>{item.hint}</span>
        </NavLink>
      ))}
    </nav>
  );
}
