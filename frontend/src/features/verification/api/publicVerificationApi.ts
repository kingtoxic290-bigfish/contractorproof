import { ApiError } from "../../../services/api/errors";
import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { isVerificationStatus, type VerificationStatus } from "../types";

export type PublicVerificationProof =
  | { confirmed: false }
  | { confirmed: true; transactionHash: string; blockNumber: number };

export type PublicVerificationResult = {
  status: VerificationStatus;
  evidenceVersionId: string | null;
  meaning: string;
  blockchainProof: PublicVerificationProof;
};

function nullableString(value: unknown): string | null | undefined {
  return value === null || (typeof value === "string" && value.trim()) ? value : undefined;
}

function parseResult(value: unknown): PublicVerificationResult | null {
  if (!isPlainRecord(value)) return null;

  const status = value.status;
  const evidenceVersionId = nullableString(value.evidenceVersionId);
  const meaning = value.meaning;
  const proof = value.blockchainProof;
  if (
    typeof status !== "string" ||
    !isVerificationStatus(status) ||
    evidenceVersionId === undefined ||
    typeof meaning !== "string" ||
    !meaning.trim() ||
    !isPlainRecord(proof) ||
    typeof proof.confirmed !== "boolean"
  ) {
    return null;
  }

  if (!proof.confirmed) {
    return { status, evidenceVersionId, meaning, blockchainProof: { confirmed: false } };
  }

  const transactionHash = proof.transactionHash;
  const blockNumber = proof.blockNumber;
  if (
    typeof transactionHash !== "string" ||
    !transactionHash.trim() ||
    typeof blockNumber !== "number" ||
    !Number.isSafeInteger(blockNumber) ||
    blockNumber <= 0
  ) {
    return null;
  }
  return {
    status,
    evidenceVersionId,
    meaning,
    blockchainProof: { confirmed: true, transactionHash, blockNumber },
  };
}

export async function createPublicVerification(input: {
  evidenceId?: string;
  evidenceVersionId?: string;
  file: File;
}): Promise<PublicVerificationResult> {
  const body = new FormData();
  if (input.evidenceId) body.append("evidenceId", input.evidenceId);
  if (input.evidenceVersionId) body.append("evidenceVersionId", input.evidenceVersionId);
  body.append("file", input.file);

  const payload = await apiRequest<unknown>("/public/verify", {
    method: "POST",
    body,
    // Public verification deliberately never participates in session-expiry redirects.
    skipAuthRedirect: true,
  });
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data) || !isPlainRecord(payload.meta)) {
    throw new Error("The public verification response is not in a known format.");
  }
  const result = parseResult(payload.data.verification);
  if (!result) {
    throw new Error("The public verification response is not in a known format.");
  }
  return result;
}

export function publicVerificationErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return error.message || "The submitted information is not valid.";
    if (error.isNotFound) return "The supplied evidence reference was not found.";
    if (error.isConflict) return "The verification request could not be completed because of a conflict.";
    if (error.isRateLimited) return "Too many requests. Please try again later.";
    if (error.status === 500) return "The verification service could not complete the request.";
    if (error.isUnavailable) return "The verification service is temporarily unavailable.";
    return "The verification request could not be completed.";
  }
  if (error instanceof TypeError) return "We couldn't reach the verification service. Please try again.";
  if (error instanceof Error && error.message.includes("not in a known format")) return error.message;
  return "The verification request could not be completed.";
}
