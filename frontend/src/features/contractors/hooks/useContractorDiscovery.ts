import { useState } from "react";
import { classifyError, queryErrorMessage, type QueryStatus } from "../../shared/query";
import { searchContractorsByCrbRegistrationNumber } from "../api/contractorsApi";
import type { PublicContractor } from "../types";

type DiscoveryStatus = QueryStatus | "pending";

export function useContractorDiscovery() {
  const [status, setStatus] = useState<DiscoveryStatus>("idle");
  const [records, setRecords] = useState<PublicContractor[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<string | null>(null);

  async function search(registrationNumber: string) {
    const trimmed = registrationNumber.trim();
    if (!trimmed) {
      return;
    }
    setStatus("pending");
    setError(null);
    setLastQuery(trimmed);
    try {
      const found = await searchContractorsByCrbRegistrationNumber(trimmed);
      setRecords(found);
      // An unknown CRB Registration Number is a legitimate empty result, not an
      // error state, and must not be confused with a failed search.
      setStatus(found.length === 0 ? "empty" : "success");
    } catch (cause) {
      setRecords([]);
      setStatus(classifyError(cause));
      setError(queryErrorMessage(cause));
    }
  }

  function reset() {
    setStatus("idle");
    setRecords([]);
    setError(null);
    setLastQuery(null);
  }

  return { status, records, error, lastQuery, search, reset };
}