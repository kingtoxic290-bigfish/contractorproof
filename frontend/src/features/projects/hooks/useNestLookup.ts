import { useState } from "react";
import { queryErrorMessage } from "../../shared/query";
import { lookupNest } from "../api/nestApi";
import type { NestLookupResponse } from "../types";

export function useNestLookup() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<NestLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function search(reference: string) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      setResult(await lookupNest(reference));
    } catch (cause) {
      setError(queryErrorMessage(cause));
    } finally {
      setPending(false);
    }
  }

  return { pending, result, error, search };
}
