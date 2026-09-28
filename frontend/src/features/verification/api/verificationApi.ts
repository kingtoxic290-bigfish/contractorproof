import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import {
  parsePublicVerification,
  parsePublicVerificationProof,
  type PublicVerification,
} from "../types";

function parseVerificationResponse(payload: unknown): PublicVerification | null {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data) || !isPlainRecord(payload.meta)) {
    return null;
  }
  const verification = parsePublicVerification(payload.data.verification);
  if (!verification || !("proof" in payload.data)) {
    return null;
  }
  const proof =
    payload.data.proof === null ? null : parsePublicVerificationProof(payload.data.proof);
  return payload.data.proof === null || proof ? { ...verification, proof } : null;
}

export async function createVerification(input: {
  evidenceId?: string;
  evidenceVersionId?: string;
  file?: File;
}): Promise<PublicVerification> {
  const presentedFile = input.file;
  const payload = presentedFile
    ? await postVerificationMultipart({
        evidenceId: input.evidenceId,
        evidenceVersionId: input.evidenceVersionId,
        file: presentedFile,
      })
    : await apiRequest<unknown>("/verification", {
        method: "POST",
        body: {
          ...(input.evidenceId ? { evidenceId: input.evidenceId } : {}),
          ...(input.evidenceVersionId ? { evidenceVersionId: input.evidenceVersionId } : {}),
        },
      });

  const record = parseVerificationResponse(payload);
  if (!record) {
    throw new Error("The verification response is not in a known format.");
  }
  return record;
}

async function postVerificationMultipart(input: {
  evidenceId?: string;
  evidenceVersionId?: string;
  file: File;
}): Promise<unknown> {
  const body = new FormData();
  if (input.evidenceId) {
    body.append("evidenceId", input.evidenceId);
  }
  if (input.evidenceVersionId) {
    body.append("evidenceVersionId", input.evidenceVersionId);
  }
  body.append("file", input.file);
  return apiRequest<unknown>("/verification", {
    method: "POST",
    body,
  });
}
