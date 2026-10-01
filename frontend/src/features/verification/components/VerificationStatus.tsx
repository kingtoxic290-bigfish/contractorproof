import { verificationTone } from "../../../components/ui/statusTone";
import { cn } from "../../../utils/cn";

/**
 * Renders one of the four backend verification states.
 *
 * The state name is always visible as text and paired with an icon, so it is
 * never communicated by colour alone. The wording is the backend's state and is
 * never renamed.
 */
export function VerificationStatus({ status }: { status: string }) {
  const { tone, icon: Icon, meaning } = verificationTone(status);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        tone,
      )}
      title={meaning}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5" />
      <span>{status}</span>
    </span>
  );
}
