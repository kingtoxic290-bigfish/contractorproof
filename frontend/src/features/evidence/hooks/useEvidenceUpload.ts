import { useCallback, useState } from "react";
import { ApiError, userFacingError } from "../../../services/api/errors";
import { createEvidence } from "../api/evidenceApi";
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
    if (error.isConflict || error.code === "HASH_CONFLICT") {
      return "conflict";
    }
    if (error.isUnavailable) {
      return "unavailable";
    }
  }
  return "failed";
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
      const evidence = await createEvidence({ milestoneId, file });
      setResult(evidence);
      setPhase("uploaded");
      return evidence;
    } catch (cause) {
      setResult(null);
      setPhase(phaseFromError(cause));
      setError(userFacingError(cause, "The evidence file could not be uploaded."));
      return null;
    }
  }, []);

  return { phase, error, result, upload, reset };
}
