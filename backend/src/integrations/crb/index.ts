import { CrbVerificationStatus } from "@prisma/client";
import type { CrbAdapter } from "./CrbAdapter";
import { createOfficialCrbAdapterFromEnv } from "./OfficialCrbAdapter";
import { sandboxCrbAdapter } from "./SandboxCrbAdapter";

export * from "./CrbAdapter";
export { SandboxCrbAdapter, sandboxCrbAdapter, SANDBOX_UNAVAILABLE_REFERENCE } from "./SandboxCrbAdapter";
export { OfficialCrbAdapter, createOfficialCrbAdapterFromEnv } from "./OfficialCrbAdapter";

/**
 * Reports CRB_UNAVAILABLE when the official connector has been requested but
 * not configured. Deliberately never falls back to sandbox records, so a
 * misconfigured production deployment cannot present fictional regulatory data
 * as a real CRB result.
 */
function unconfiguredOfficialAdapter(): CrbAdapter {
  return {
    source: "CRB_OFFICIAL",
    isConfigured: () => false,
    lookup: async (registrationReference) => ({
      registrationReference: registrationReference.trim().toUpperCase(),
      status: CrbVerificationStatus.UNAVAILABLE,
      registrationNumber: null,
      registeredName: null,
      category: null,
      registrationClass: null,
      registrationDate: null,
      expiryDate: null,
      externalReference: null,
      failureCode: "CRB_NOT_CONFIGURED",
    }),
  };
}

/** Selects the active CRB adapter from configuration. */
function resolveAdapter(): CrbAdapter {
  const mode = (process.env.CRB_MODE ?? "sandbox").trim().toLowerCase();
  if (mode !== "official") {
    return sandboxCrbAdapter;
  }
  const official = createOfficialCrbAdapterFromEnv();
  return official.isConfigured() ? official : unconfiguredOfficialAdapter();
}

let override: (() => CrbAdapter) | null = null;

/** Test seam. Calling with no argument restores configuration-driven selection. */
export function setCrbAdapterFactory(factory?: () => CrbAdapter): void {
  override = factory ?? null;
}

export function crbAdapter(): CrbAdapter {
  return (override ? override() : resolveAdapter());
}