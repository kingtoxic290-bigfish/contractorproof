import { ensureLocalHardhat, stopQaHardhat } from "./hardhat";

/**
 * Start one Hardhat JSON-RPC node for the whole Vitest run when possible.
 * Live chain tests then connect instead of each file racing spawn/teardown.
 */
export async function setup() {
  const ready = await ensureLocalHardhat();
  if (!ready) {
    console.warn(
      "[qa] local Hardhat JSON-RPC was not started; live blockchain tests will fail closed",
    );
  }
  return async () => {
    stopQaHardhat();
    // Give the OS a moment to release :8545 before the next suite.
    await new Promise((resolve) => setTimeout(resolve, 200));
  };
}
