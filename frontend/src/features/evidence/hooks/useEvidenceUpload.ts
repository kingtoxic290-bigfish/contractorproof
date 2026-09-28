import { useCallback, useState } from "react";
import { ApiError, userFacingError } from "../../../services/api/errors";
import { uploadEvidence } from "../api/evidenceApi";
import type { EvidenceUploadPhase, PublicEvidence } from "../types";
import { validateEvidenceFile } from "../validation";

function phaseFromError(error: unknown): EvidenceUploadPhase {
  if (error instanceof ApiError) {
    if (
      error.code === "FILE_TYPE_NOT_ALLOWED" ||
      (error.status === 400 && error.message.includes("file type"))
    ) {
      return "unsupported";
    }
    if (error.code === "FILE_TOO_LARGE") {
      return "too_large";
    }
    if (error.isUnauthorized) {
      return "unauthorized";
    }
    if (error.isForbidden) {
      return "forbidden";
    }
    if (error.isNotFound) {
      return "notfound";
    }
    if (error.isConflict || error.code === "HASH_CONFLICT") {
      return "conflict";
    }
    if (error.isUnavailable) {
      return "unavailable";
    }
  }
  return "failed";
}

function uploadErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isUnauthorized) {
      return "Your session has expired. Sign in again to upload evidence.";
    }
    if (error.isForbidden) {
      return "You do not have permission to upload evidence.";
    }
    if (error.isNotFound) {
      return "The selected milestone was not found.";
    }
  }
  return userFacingError(error, "The evidence file could not be uploaded.");
}

export function useEvidenceUpload() {
  const [phase, setPhase] = useState<EvidenceUploadPhase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicEvidence | null>(null);

  const reset = useCallback(() => {
    setPhase("ready");
    setError(null);
    setResult(null);
  }, []);

  const upload = useCallback(async (milestoneId: string, file: File): Promise<PublicEvidence | null> => {
    const local = validateEvidenceFile(file);
    if (!local.ok) {
      setResult(null);
      if (local.reason === "too_large") {
        setPhase("too_large");
        setError("The selected file is larger than the 25 MB upload limit.");
        return null;
      }
      if (local.reason === "unsupported") {
        setPhase("unsupported");
        setError("That file type is not allowed for evidence uploads.");
        return null;
      }
      setPhase("failed");
      setError("The selected file is empty.");
      return null;
    }

    setPhase("uploading");
    setError(null);
    setResult(null);
    try {
      const evidence = await uploadEvidence({ milestoneId, file });
      setResult(evidence);
      setPhase("uploaded");
      return evidence;
    } catch (cause) {
      setResult(null);
      setPhase(phaseFromError(cause));
      setError(uploadErrorMessage(cause));
      return null;
    }
  }, []);

  return { phase, error, result, upload, reset };
}
