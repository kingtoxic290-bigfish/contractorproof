import { useState } from "react";
import { Copy } from "lucide-react";
import { cn } from "../../utils/cn";

/**
 * Copies a backend-returned value (typically a SHA-256 hash) to the clipboard.
 *
 * The button keeps a visible text label that is also its accessible name, and
 * reports the outcome in a polite live region. A clipboard failure is reported
 * truthfully rather than silently ignored.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  label: string;
  className?: string;
}) {
  const [message, setMessage] = useState("");

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied.`);
    } catch {
      setMessage("Clipboard access is unavailable; select the full value to copy it.");
    }
  }

  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={label}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-stone-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{label}</span>
      </button>
      <p className="mt-1 text-xs text-stone-600" role="status" aria-live="polite">
        {message}
      </p>
    </div>
  );
}