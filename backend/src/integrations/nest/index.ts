import { NestAdapterError, type NestProcurementAdapter } from "./NestProcurementAdapter";
import { createPublicOcdsNestAdapterFromEnv } from "./PublicOcdsNestAdapter";
import { sandboxNestAdapter } from "./SandboxNestAdapter";

export * from "./NestProcurementAdapter";
export { PublicOcdsNestAdapter, createPublicOcdsNestAdapterFromEnv, isAllowedNestOcdsBase } from "./PublicOcdsNestAdapter";
export { SandboxNestAdapter, sandboxNestAdapter } from "./SandboxNestAdapter";

export function nestProcurementAdapter(): NestProcurementAdapter {
  const mode = (process.env.NEST_MODE ?? "sandbox").trim().toLowerCase();
  if (mode === "sandbox") return sandboxNestAdapter;
  if (mode !== "public_ocds") {
    throw new NestAdapterError("NEST_NOT_CONFIGURED", "NEST_MODE must be sandbox or public_ocds.");
  }
  const adapter = createPublicOcdsNestAdapterFromEnv();
  if (!adapter) {
    throw new NestAdapterError("NEST_NOT_CONFIGURED", "Public NeST OCDS mode requires the documented HTTPS base URL.");
  }
  return adapter;
}