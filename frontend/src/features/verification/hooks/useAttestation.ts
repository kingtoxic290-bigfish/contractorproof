import { useCallback, useState } from "react";
import { createAttestation } from "../api/attestationApi";
import {
  attestationActionMessage,
  phaseFromActionError,
  type ActionPhase,
  type PublicAttestation,
} from "../types";
import { attestationValidationMessage, validateAttestationInput } from "../validation";

export function useAttestation() {
  const [phase, setPhase] = useState<ActionPhase>("ready");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublicAttestation | null>(null);

  const reset = useCallback(() => {
    setPhase("ready");
    setError(null);
    setResult(null);
  }, []);

  const attest = useCallback(
    async (input: {
      evidenceId?: string;
      milestoneId?: string;
      decision?: string;
      comment?: string;
    }): Promise<PublicAttestation | null> => {
      const parsed = validateAttestationInput(input);
      if (!parsed.ok) {
        setResult(null);
        setPhase("validation");
        setError(attestationValidationMessage(parsed.reason));
        return null;
      }

      setPhase("submitting");
      setError(null);
      setResult(null);
      try {
        const attestation = await createAttestation({
          evidenceId: parsed.evidenceId,
          milestoneId: parsed.milestoneId,
          decision: parsed.decision,
          comment: parsed.comment,
        });
        setResult(attestation);
        setPhase("recorded");
        return attestation;
      } catch (cause) {
        setResult(null);
        setPhase(phaseFromActionError(cause));
        setError(attestationActionMessage(cause));
        return null;
      }
    },
    [],
  );

  return { phase, error, result, attest, reset };
}
