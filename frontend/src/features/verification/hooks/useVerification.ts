import { useCallback, useState } from "react";
import { createVerification } from "../api/verificationApi";
import {
  phaseFromActionError,
  verificationActionMessage,
  type ActionPhase,
  type PublicVerification,
} from "../types";
import { targetValidationMessage, validateVerificationTarget } from "../validation";

export function useVerification() {
  const [phase, setPhase] = useState<ActionPhase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicVerification | null>(null);

  const reset = useCallback(() => {
    setPhase("ready");
    setError(null);
    setResult(null);
  }, []);

  const compare = useCallback(
    async (input: {
      evidenceId?: string;
      evidenceVersionId?: string;
      file?: File;
    }): Promise<PublicVerification | null> => {
      const target = validateVerificationTarget(input);
      if (!target.ok) {
        setResult(null);
        setPhase("validation");
        setError(targetValidationMessage(target.reason));
        return null;
      }

      setPhase("submitting");
      setError(null);
      setResult(null);
      try {
        const verification = await createVerification({
          evidenceId: target.evidenceId,
          evidenceVersionId: target.evidenceVersionId,
          file: input.file,
        });
        setResult(verification);
        setPhase("recorded");
        return verification;
      } catch (cause) {
        setResult(null);
        setPhase(phaseFromActionError(cause));
        setError(verificationActionMessage(cause));
        return null;
      }
    },
    [],
  );

  return { phase, error, result, compare, reset };
}
