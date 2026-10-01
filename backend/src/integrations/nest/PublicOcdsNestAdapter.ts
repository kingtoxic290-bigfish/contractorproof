import {
  NestAdapterError,
  normalizeOcdsRecordPackage,
  validateOcid,
  type NestProcurementAdapter,
  type ProcurementLookup,
} from "./NestProcurementAdapter";

export const NEST_OCDS_BASE_URL = "https://nest.go.tz/gateway/nest-data-portal-api/api/";
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

export function isAllowedNestOcdsBase(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:"
      && parsed.hostname === "nest.go.tz"
      && parsed.port === ""
      && parsed.username === ""
      && parsed.password === ""
      && parsed.pathname === "/gateway/nest-data-portal-api/api/"
      && parsed.search === ""
      && parsed.hash === "";
  } catch {
    return false;
  }
}

async function boundedBody(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS response exceeded the allowed size.");
  }
  if (!response.body) {
    throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS response body is missing.");
  }

  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new NestAdapterError("NEST_INVALID_RESPONSE", "OCDS response exceeded the allowed size.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total).toString("utf8");
}

export class PublicOcdsNestAdapter implements NestProcurementAdapter {
  readonly sourceSystem = "NEST_OCDS_PUBLIC" as const;

  constructor(
    private readonly baseUrl = NEST_OCDS_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs = 5000,
  ) {
    if (!isAllowedNestOcdsBase(baseUrl)) {
      throw new NestAdapterError("NEST_NOT_CONFIGURED", "NeST OCDS base URL is not on the allowed HTTPS host and path.");
    }
  }

  async lookupByOcid(input: string): Promise<ProcurementLookup> {
    const ocid = validateOcid(input);
    const url = new URL(`records/${encodeURIComponent(ocid)}`, this.baseUrl);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.status === 404) {
        throw new NestAdapterError("NEST_NOT_FOUND", "NeST OCDS record was not found.");
      }
      if (!response.ok) {
        throw new NestAdapterError("NEST_UNAVAILABLE", "NeST OCDS returned an unavailable response.");
      }
      if (!response.headers.get("content-type")?.toLowerCase().includes("json")) {
        throw new NestAdapterError("NEST_INVALID_RESPONSE", "NeST OCDS response was not JSON.");
      }

      let payload: unknown;
      try {
        payload = JSON.parse(await boundedBody(response)) as unknown;
      } catch (error) {
        if (error instanceof NestAdapterError) throw error;
        throw new NestAdapterError("NEST_INVALID_RESPONSE", "NeST OCDS response was not valid JSON.");
      }
      const normalized = normalizeOcdsRecordPackage(payload, ocid);
      return {
        sourceSystem: this.sourceSystem,
        externalReference: ocid,
        sourceRecordId: normalized.sourceRecordId,
        sourceReference: url.toString(),
        observations: normalized.observations,
      };
    } catch (error) {
      if (error instanceof NestAdapterError) throw error;
      if (controller.signal.aborted) {
        throw new NestAdapterError("NEST_TIMEOUT", "NeST OCDS request timed out.");
      }
      throw new NestAdapterError("NEST_UNAVAILABLE", "NeST OCDS could not be reached.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export function createPublicOcdsNestAdapterFromEnv(
  fetchImpl: typeof fetch = fetch,
): PublicOcdsNestAdapter | null {
  const configuredBase = process.env.NEST_OCDS_BASE_URL ?? NEST_OCDS_BASE_URL;
  if (!isAllowedNestOcdsBase(configuredBase)) return null;
  return new PublicOcdsNestAdapter(configuredBase, fetchImpl);
}