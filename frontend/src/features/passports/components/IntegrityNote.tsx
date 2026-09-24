import { StateLabel } from "../../shared/StateLabel";
import { integrityExplanation } from "../types";

export function IntegrityNote({ status }: { status: string }) {
  const explanation = integrityExplanation(status);

  return (
    <div className="space-y-1">
      <StateLabel value={status} />
      {explanation ? <p className="text-sm text-stone-600">{explanation}</p> : null}
    </div>
  );
}
