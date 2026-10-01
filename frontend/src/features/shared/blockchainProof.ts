import { asNullableString, asRequiredString, isPlainRecord } from "./query";

/**
 * Blockchain proof as returned by the workflow endpoints.
 *
 * The backend derives `confirmationState` from whether a transaction hash and a
 * positive block number are present. This parser does not recompute it and does
 * not upgrade a PENDING proof to CONFIRMED.
 */
export type WorkflowProof = {
  id: string;
  eventType: string;
  referenceId: string | null;
  txHash: string | null;
  blockNumber: number | null;
  confirmationState: "CONFIRMED" | "PENDING";
  confirmed: boolean;
};

export function parseWorkflowProof(value: unknown): WorkflowProof | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  const id = asRequiredString(value.id);
  const eventType = asRequiredString(value.eventType);
  const referenceId = asNullableString(value.referenceId);
  const txHash = asNullableString(value.txHash);
  const blockNumber =
    value.blockNumber === null
      ? null
      : typeof value.blockNumber === "number" &&
          Number.isSafeInteger(value.blockNumber) &&
          value.blockNumber >= 0
        ? value.blockNumber
        : undefined;
  const confirmationState = value.confirmationState;
  const confirmed = value.confirmed;

  if (
    !id ||
    !eventType ||
    referenceId === undefined ||
    txHash === undefined ||
    blockNumber === undefined ||
    (confirmationState !== "CONFIRMED" && confirmationState !== "PENDING") ||
    typeof confirmed !== "boolean"
  ) {
    return null;
  }

  return { id, eventType, referenceId, txHash, blockNumber, confirmationState, confirmed };
}