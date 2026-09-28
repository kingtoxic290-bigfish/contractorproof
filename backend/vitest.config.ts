import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    globalSetup: ["./test/qa/hardhat-global-setup.ts"],
    // Live Hardhat suites share account #0; keep chain-touching files sequential in-file.
    pool: "forks",
    fileParallelism: true,
    // Hardhat child can briefly keep handles open after SIGKILL.
    teardownTimeout: 10_000,
    hookTimeout: 60_000,
  },
});
