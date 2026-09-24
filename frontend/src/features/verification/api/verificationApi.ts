import { apiRequest } from "../../../services/api/client";
import { isPlainRecord } from "../../shared/query";
import { parsePublicVerification, type PublicVerification } from "../types";

function unwrapVerificationData(payload: unknown): unknown {
  if (!isPlainRecord(payload) || !isPlainRecord(payload.data)) {
    return undefined;
  }
  return payload.data.verification;
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

  const record = parsePublicVerification(unwrapVerificationData(payload));
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
