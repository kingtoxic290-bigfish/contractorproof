import { useCallback } from "react";
import { useAsyncResource } from "../../shared/useAsyncResource";
import { getOfficialPassports } from "../api/passportsApi";

export function useOfficialPassport() {
  const loader = useCallback(() => getOfficialPassports(), []);
  return useAsyncResource(loader);
}
