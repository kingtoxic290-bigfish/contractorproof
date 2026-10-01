import { CrbVerificationStatus } from "@prisma/client";

/**
 * Authoritative contractor-registration lookup.
 *
 * CRB is the source of truth for contractor registration. This adapter is the
 * only place ContractorProof talks to it, so an official CRB connector can be
 * introduced without touching business logic.
 *
 * The adapter returns factual fields only. It never returns a score, a rating
 * or a judgement about the contractor.
 */
export type CrbAdapterLookup = {
  registrationReference: string;
  /** Factual status as reported by the source. Never inferred locally. */
  status: CrbVerificationStatus;
  registrationNumber: string | null;
  registeredName: string | null;
  category: string | null;
  registrationClass: string | null;
  registrationDate: string | null;
  expiryDate: string | null;
  /** Opaque reference issued by the source for this response, if any. */
  externalReference: string | null;
  /**
   * Machine-readable detail when the lookup could not be completed, e.g.
   * `CRB_TIMEOUT`, `CRB_NOT_CONFIGURED`, `CRB_UNREACHABLE`. Never free text
   * and never anything containing credentials.
   */
  failureCode: string | null;
};

export type CrbAdapter = {
  /** Identifies the adapter in stored records, for audit. */
  readonly source: "SANDBOX" | "CRB_OFFICIAL";
  /** True when this adapter is ready to answer lookups. */
  isConfigured(): boolean;
  /**
   * Performs one lookup.
   *
   * Implementations must resolve rather than throw for expected upstream
   * conditions (not configured, timeout, unreachable) and report them as a
   * factual status. An upstream failure is never reported as NOT_REGISTERED.
   */
  lookup(registrationReference: string): Promise<CrbAdapterLookup>;
};

export const CRB_FAILURE_CODES = {
  NOT_CONFIGURED: "CRB_NOT_CONFIGURED",
  UNREACHABLE: "CRB_UNREACHABLE",
  TIMEOUT: "CRB_TIMEOUT",
  MALFORMED_RESPONSE: "CRB_MALFORMED_RESPONSE",
} as const;

/**
 * Validation of a ContractorProof-stored reference before any outbound call.
 * Deliberately permissive on alphabet so real CRB formats are not rejected, but
 * it blocks control characters and obvious injection attempts.
 */
export const CRB_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_-]{1,63}$/;

export function isValidCrbReference(value: string): boolean {
  return CRB_REFERENCE_PATTERN.test(value.trim());
}