import { CrbVerificationStatus } from "@prisma/client";
import {
  CRB_FAILURE_CODES,
  isValidCrbReference,
  type CrbAdapter,
  type CrbAdapterLookup,
} from "./CrbAdapter";

/**
 * Official CRB connector.
 *
 * This adapter performs an HTTP call to an authorized CRB integration endpoint.
 * ContractorProof does NOT scrape CRB, automate a CRB login, or call any
 * undocumented CRB interface. Unless an operator configures an authorized
 * endpoint, this adapter reports CRB_NOT_CONFIGURED and performs no network I/O.
 *
 * Credentials are read from the environment only. They are never hard-coded,
 * never logged, and never persisted.
 */
export type OfficialCrbConfig = {
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
  /** Path template appended to baseUrl. Single {reference} placeholder. */
  lookupPath: string;
};

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_TIMEOUT_MS = 30_000;
const DEFAULT_LOOKUP_PATH = "/registrations/{reference}";

/**
 * Blocks requests to loopback, link-local and private ranges so a
 * misconfigured base URL cannot be used to reach internal services (SSRF).
 */
function assertSafeBaseUrl(rawUrl: string): void {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("CRB base URL is not a valid absolute URL");
  }
  if (url.protocol !== "https:") {
    // Plain HTTP would expose the API credential in transit.
    throw new Error("CRB base URL must use https");
  }
  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "::1" || host.endsWith(".localhost");
  const isPrivateV4 =
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^127\./.test(host) ||
    /^169\.254\./.test(host);
  if (isLoopback || isPrivateV4 || host.startsWith("[fd")) {
    throw new Error("CRB base URL must not target a loopback or private address");
  }
}

/** Maps an upstream status to a factual ContractorProof state. */
function mapUpstreamStatus(raw: string | null | undefined): {
  status: CrbVerificationStatus;
  failureCode: string | null;
} {
  switch ((raw ?? "").trim().toUpperCase()) {
    case "REGISTERED":
    case "ACTIVE":
      return { status: CrbVerificationStatus.REGISTERED, failureCode: null };
    case "EXPIRED":
      return { status: CrbVerificationStatus.EXPIRED, failureCode: null };
    case "SUSPENDED":
      return { status: CrbVerificationStatus.SUSPENDED, failureCode: null };
    case "NOT_REGISTERED":
    case "REVOKED":
      return { status: CrbVerificationStatus.NOT_REGISTERED, failureCode: null };
    default:
      // An unrecognised upstream state is not guessed at and is not treated as
      // a successful registration.
      return { status: CrbVerificationStatus.UNAVAILABLE, failureCode: CRB_FAILURE_CODES.MALFORMED_RESPONSE };
  }
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

export class OfficialCrbAdapter implements CrbAdapter {
  readonly source = "CRB_OFFICIAL" as const;
  private readonly config: OfficialCrbConfig | null;

  constructor(config?: OfficialCrbConfig | null) {
    this.config = config ?? null;
  }

  isConfigured(): boolean {
    return this.config !== null;
  }

  private unavailable(failureCode: string, reference: string): CrbAdapterLookup {
    return {
      registrationReference: reference,
      status: CrbVerificationStatus.UNAVAILABLE,
      registrationNumber: null,
      registeredName: null,
      category: null,
      registrationClass: null,
      registrationDate: null,
      expiryDate: null,
      externalReference: null,
      failureCode,
    };
  }

  async lookup(registrationReference: string): Promise<CrbAdapterLookup> {
    const reference = registrationReference.trim().toUpperCase();

    if (!isValidCrbReference(reference)) {
      return { ...this.unavailable("CRB_INVALID_REFERENCE", reference), status: CrbVerificationStatus.INVALID_REFERENCE };
    }
    if (!this.config) {
      return this.unavailable(CRB_FAILURE_CODES.NOT_CONFIGURED, reference);
    }

    const timeoutMs = Math.min(Math.max(this.config.timeoutMs, 1_000), MAX_TIMEOUT_MS);
    const path = this.config.lookupPath.replace("{reference}", encodeURIComponent(reference));
    const url = `${this.config.baseUrl.replace(/\/+$/, "")}${path}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          // Credential is transmitted only to the configured host.
          authorization: `Bearer ${this.config.apiKey}`,
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "error",
      });

      if (response.status === 404) {
        return {
          registrationReference: reference,
          status: CrbVerificationStatus.NOT_REGISTERED,
          registrationNumber: null,
          registeredName: null,
          category: null,
          registrationClass: null,
          registrationDate: null,
          expiryDate: null,
          externalReference: null,
          failureCode: null,
        };
      }
      if (!response.ok) {
        return this.unavailable(CRB_FAILURE_CODES.UNREACHABLE, reference);
      }

      const payload = (await response.json()) as Record<string, unknown>;
      const { status, failureCode } = mapUpstreamStatus(text(payload.status));
      return {
        registrationReference: reference,
        status,
        registrationNumber: text(payload.registrationNumber) ?? reference,
        registeredName: text(payload.name),
        category: text(payload.category),
        registrationClass: text(payload.registrationClass),
        registrationDate: text(payload.registrationDate),
        expiryDate: text(payload.expiryDate),
        externalReference: text(payload.reference),
        failureCode,
      };
    } catch (error) {
      const code =
        error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
          ? CRB_FAILURE_CODES.TIMEOUT
          : CRB_FAILURE_CODES.UNREACHABLE;
      return this.unavailable(code, reference);
    }
  }
}

/**
 * Builds the official adapter from configuration, or returns it unconfigured.
 * Never throws for missing configuration so the application can still run and
 * report a truthful CRB_UNAVAILABLE.
 */
export function createOfficialCrbAdapterFromEnv(): OfficialCrbAdapter {
  const baseUrl = process.env.CRB_API_BASE_URL?.trim() ?? "";
  const apiKey = process.env.CRB_API_KEY?.trim() ?? "";
  if (!baseUrl || !apiKey) {
    return new OfficialCrbAdapter(null);
  }
  try {
    assertSafeBaseUrl(baseUrl);
  } catch {
    // An unsafe or malformed URL is treated as not configured rather than
    // being used for a request.
    return new OfficialCrbAdapter(null);
  }
  return new OfficialCrbAdapter({
    baseUrl,
    apiKey,
    timeoutMs: Number(process.env.CRB_API_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS),
    lookupPath: process.env.CRB_API_LOOKUP_PATH?.trim() || DEFAULT_LOOKUP_PATH,
  });
}