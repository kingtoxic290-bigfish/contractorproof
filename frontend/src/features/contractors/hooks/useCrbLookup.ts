import { useState } from "react";
import { queryErrorMessage } from "../../shared/query";
import { lookupCrb } from "../api/crbApi";
import type { CrbLookupResponse } from "../types";

export function useCrbLookup() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CrbLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(registrationNumber: string) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await lookupCrb(registrationNumber));
    } catch (cause) {
      setError(queryErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return { pending, result, error, search };
}
