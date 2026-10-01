import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../utils/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

/**
 * Primary is reserved for the single most important action on a screen.
 * Secondary is used for supporting actions. Every size shares the same control
 * height for a given size so button rows stay visually aligned.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a] disabled:cursor-not-allowed disabled:opacity-60",
        size === "md" ? "h-9 px-3.5 text-sm" : "h-8 px-2.5 text-xs",
        variant === "primary" && "bg-[#0f3d3a] text-white hover:bg-[#0d3331]",
        variant === "secondary" && "border border-stone-300 bg-white text-stone-800 hover:bg-stone-50",
        variant === "ghost" && "text-stone-700 hover:bg-stone-100",
        className,
      )}
      {...props}
    />
  );
}