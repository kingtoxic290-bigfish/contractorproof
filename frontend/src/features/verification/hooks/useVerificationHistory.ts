import { useEffect, useState } from "react";
import { classifyError, queryErrorMessage, type QueryStatus } from "../../shared/query";
import {
  listVerificationHistory,
  type VerificationHistoryEntry,
} from "../api/verificationHistoryApi";

export function useVerificationHistory(evidenceId?: string, evidenceVersionId?: string) {
  const [status, setStatus] = useState<QueryStatus>("idle");
  const [data, setData] = useState<VerificationHistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!evidenceId && !evidenceVersionId) {
      setStatus("idle");
      setData([]);
      setError(null);
      return;
    }

    let active = true;
    setStatus("loading");
    setData([]);
    setError(null);
    void listVerificationHistory()
      .then((history) => {
        if (!active) return;
        const matching = history.filter(
          (entry) =>
            (!evidenceId || entry.evidenceId === evidenceId) &&
            (!evidenceVersionId || entry.evidenceVersionId === evidenceVersionId),
        );
        setData(matching);
        setStatus(matching.length ? "success" : "empty");
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setStatus(classifyError(cause));
        setError(
          cause instanceof Error && !(cause instanceof TypeError)
            ? cause.message
            : queryErrorMessage(cause),
        );
      });

    return () => {
      active = false;
    };
  }, [evidenceId, evidenceVersionId, reloadKey]);

  return { status, records: data, error, retry: () => setReloadKey((key) => key + 1) };
}