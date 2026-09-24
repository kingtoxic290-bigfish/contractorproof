import { describe, expect, it } from "vitest";
import { assertProductionBlockchainConfig, resolveJwtSecret } from "../src/config/secrets";

describe("JWT and blockchain fail-closed configuration", () => {
  it("refuses a missing or well-known JWT secret in production", () => {
    expect(() => resolveJwtSecret({ nodeEnv: "production" })).toThrow(/JWT_SECRET/);
    expect(() =>
      resolveJwtSecret({ nodeEnv: "production", jwtSecret: "dev-only-change-me" }),
    ).toThrow(/JWT_SECRET/);
    expect(() =>
      resolveJwtSecret({ nodeEnv: "production", jwtSecret: "short" }),
    ).toThrow(/JWT_SECRET/);
  });

  it("accepts a strong production secret and an explicit development secret", () => {
    const strong = "a-unique-production-secret-value-32ch";
    expect(resolveJwtSecret({ nodeEnv: "production", jwtSecret: strong })).toBe(strong);
    expect(resolveJwtSecret({ nodeEnv: "development", jwtSecret: "local-dev-secret" })).toBe(
      "local-dev-secret",
    );
  });

  it("allows a test/insecure fallback only when explicitly configured", () => {
    expect(resolveJwtSecret({ nodeEnv: "test" })).toBe("dev-only-change-me");
    expect(resolveJwtSecret({ nodeEnv: "development", allowInsecure: true })).toBe(
      "dev-only-change-me",
    );
    expect(() => resolveJwtSecret({ nodeEnv: "development" })).toThrow(/JWT_SECRET/);
  });

  it("requires blockchain credentials in production only", () => {
    expect(() =>
      assertProductionBlockchainConfig({ nodeEnv: "production" }),
    ).toThrow(/CONTRACT_ADDRESS/);
    expect(() =>
      assertProductionBlockchainConfig({
        nodeEnv: "production",
        contractAddress: "0xabc",
      }),
    ).toThrow(/BLOCKCHAIN_PRIVATE_KEY/);
    expect(() =>
      assertProductionBlockchainConfig({ nodeEnv: "development" }),
    ).not.toThrow();
    expect(() =>
      assertProductionBlockchainConfig({
        nodeEnv: "production",
        contractAddress: "0xabc",
        privateKey: "0xkey",
      }),
    ).not.toThrow();
  });
});
