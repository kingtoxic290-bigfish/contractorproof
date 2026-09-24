export const WELL_KNOWN_JWT_SECRETS = new Set([
  "dev-only-change-me",
  "replace-with-a-long-random-secret",
  "secret",
  "jwt-secret",
  "changeme",
]);

export function resolveJwtSecret(input: {
  nodeEnv: string;
  jwtSecret?: string;
  allowInsecure?: boolean;
}): string {
  const secret = input.jwtSecret?.trim() ?? "";
  const nodeEnv = input.nodeEnv || "development";

  if (nodeEnv === "production") {
    if (!secret || WELL_KNOWN_JWT_SECRETS.has(secret) || secret.length < 32) {
      throw new Error(
        "JWT_SECRET must be set to a unique secret of at least 32 characters in production",
      );
    }
    return secret;
  }

  if (secret) {
    return secret;
  }

  if (nodeEnv === "test" || input.allowInsecure) {
    return "dev-only-change-me";
  }

  throw new Error(
    "JWT_SECRET is required. Set JWT_SECRET in .env, or ALLOW_INSECURE_JWT_SECRET=true for local development only",
  );
}

export function assertProductionBlockchainConfig(input: {
  nodeEnv: string;
  contractAddress?: string;
  privateKey?: string;
}): void {
  if (input.nodeEnv !== "production") {
    return;
  }
  if (!input.contractAddress?.trim()) {
    throw new Error("CONTRACT_ADDRESS is required in production");
  }
  if (!input.privateKey?.trim()) {
    throw new Error("BLOCKCHAIN_PRIVATE_KEY is required in production");
  }
}
