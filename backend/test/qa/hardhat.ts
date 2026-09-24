import { spawn, type ChildProcess } from "child_process";
import { readFileSync } from "fs";
import path from "path";
import { ContractFactory, JsonRpcProvider, Wallet } from "ethers";

/**
 * Hardhat node account #0. This is the published local-dev key, not a production secret.
 * See https://hardhat.org/hardhat-network/docs/reference#accounts
 */
export const HARDHAT_TEST_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

export const HARDHAT_RPC_URL = "http://127.0.0.1:8545";
export const HARDHAT_CHAIN_ID = 31337;

const ARTIFACT_PATH = path.resolve(
  __dirname,
  "../../../contracts/artifacts/contracts/ContractorProofRegistry.sol/ContractorProofRegistry.json",
);
const CONTRACTS_ROOT = path.resolve(__dirname, "../../../contracts");

let startedByQa: ChildProcess | undefined;

export async function isLocalHardhatAvailable(): Promise<boolean> {
  try {
    const provider = new JsonRpcProvider(HARDHAT_RPC_URL);
    const network = await Promise.race([
      provider.getNetwork(),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("rpc timeout")), 2_000);
      }),
    ]);
    return Number(network.chainId) === HARDHAT_CHAIN_ID;
  } catch {
    return false;
  }
}

export async function ensureLocalHardhat(): Promise<boolean> {
  if (await isLocalHardhatAvailable()) {
    return true;
  }

  startedByQa = spawn("npx", ["hardhat", "node"], {
    cwd: CONTRACTS_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 20_000);
    const onData = (chunk: Buffer) => {
      if (chunk.toString().includes("Started HTTP")) {
        clearTimeout(timer);
        resolve(true);
      }
    };
    startedByQa?.stdout?.on("data", onData);
    startedByQa?.stderr?.on("data", onData);
    startedByQa?.on("exit", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });

  if (!ready) {
    stopQaHardhat();
    return false;
  }
  for (let i = 0; i < 10; i += 1) {
    if (await isLocalHardhatAvailable()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  stopQaHardhat();
  return false;
}

export function stopQaHardhat(): void {
  if (!startedByQa) {
    return;
  }
  startedByQa.kill("SIGTERM");
  startedByQa = undefined;
}

export async function deployContractorProofRegistry() {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
    abi: unknown[];
    bytecode: string;
  };
  const provider = new JsonRpcProvider(HARDHAT_RPC_URL);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
    throw new Error(`expected Hardhat chain ${HARDHAT_CHAIN_ID}, got ${network.chainId}`);
  }
  const wallet = new Wallet(HARDHAT_TEST_PRIVATE_KEY, provider);
  const factory = new ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  await provider.getBlockNumber();
  return {
    address: await contract.getAddress(),
    provider,
    wallet,
    contract,
  };
}
