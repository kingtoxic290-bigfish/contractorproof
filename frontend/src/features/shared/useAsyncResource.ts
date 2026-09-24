import { useCallback, useEffect, useState } from "react";
import { classifyError, queryErrorMessage, type QueryStatus } from "./query";

export function useAsyncResource<T>(loader: () => Promise<T>, enabled = true) {
  const [status, setStatus] = useState<QueryStatus>(enabled ? "loading" : "idle");
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setStatus("idle");
      setData(null);
      setError(null);
      return;
    }

    setStatus("loading");
    setError(null);
    try {
      const result = await loader();
      setData(result);
      setStatus("success");
    } catch (cause) {
      setData(null);
      setStatus(classifyError(cause));
      setError(queryErrorMessage(cause));
    }
  }, [enabled, loader]);

  useEffect(() => {
    void load();
  }, [load]);

  return { status, data, error, retry: load };
}
