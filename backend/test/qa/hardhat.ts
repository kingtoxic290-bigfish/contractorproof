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

const startedByQa: ChildProcess[] = [];

async function rpcChainId(rpcUrl: string = HARDHAT_RPC_URL): Promise<number | null> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "eth_chainId",
        params: [],
      }),
      signal: AbortSignal.timeout(2_000),
    });
    const json = (await response.json()) as { result?: string };
    if (!json.result) {
      return null;
    }
    return Number.parseInt(json.result, 16);
  } catch {
    return null;
  }
}

export async function isLocalHardhatAvailable(rpcUrl: string = HARDHAT_RPC_URL): Promise<boolean> {
  const chainId = await rpcChainId(rpcUrl);
  return chainId === HARDHAT_CHAIN_ID;
}

/**
 * Ensure a local Hardhat JSON-RPC node is reachable on HARDHAT_RPC_URL.
 * Starts `npx hardhat node` when nothing answers; if the port is already
 * occupied by Hardhat, reuses it. Does not require a manual RPC start.
 */
export async function ensureLocalHardhat(
  rpcUrl: string = HARDHAT_RPC_URL,
  port: number = 8545,
): Promise<boolean> {
  if (await isLocalHardhatAvailable(rpcUrl)) {
    return true;
  }

  const child = spawn("npx", ["hardhat", "node", "--port", String(port)], {
    cwd: CONTRACTS_ROOT,
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
    detached: true,
  });
  startedByQa.push(child);

  let sawAddrInUse = false;
  const ready = await new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => resolve(false), 25_000);
    const onData = (chunk: Buffer) => {
      const text = chunk.toString();
      if (text.includes("Started HTTP")) {
        clearTimeout(timer);
        resolve(true);
      }
      if (/EADDRINUSE|address already in use/i.test(text)) {
        sawAddrInUse = true;
      }
    };
    child.stdout?.on("data", onData);
    child.stderr?.on("data", onData);
    child.on("exit", () => {
      clearTimeout(timer);
      // Port may already host a healthy Hardhat we did not start.
      resolve(false);
    });
  });

  if (!ready) {
    const index = startedByQa.indexOf(child);
    if (index >= 0) startedByQa.splice(index, 1);
    child.kill("SIGTERM");
    if (sawAddrInUse) {
      return isLocalHardhatAvailable(rpcUrl);
    }
    return false;
  }

  for (let i = 0; i < 25; i += 1) {
    if (await isLocalHardhatAvailable(rpcUrl)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  child.kill("SIGKILL");
  const index = startedByQa.indexOf(child);
  if (index >= 0) startedByQa.splice(index, 1);
  return false;
}

export function stopQaHardhat(): void {
  for (const child of startedByQa.splice(0)) {
    try {
      if (child.pid) {
        // Kill the whole process group when possible (npx → hardhat node).
        process.kill(-child.pid, "SIGKILL");
      }
    } catch {
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited
      }
    }
  }
}

export async function deployContractorProofRegistry(rpcUrl: string = HARDHAT_RPC_URL) {
  const artifact = JSON.parse(readFileSync(ARTIFACT_PATH, "utf8")) as {
    abi: unknown[];
    bytecode: string;
  };
  const provider = new JsonRpcProvider(rpcUrl);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== HARDHAT_CHAIN_ID) {
    throw new Error(`expected Hardhat chain ${HARDHAT_CHAIN_ID}, got ${network.chainId}`);
  }
  const wallet = new Wallet(HARDHAT_TEST_PRIVATE_KEY, provider);
  // Sync nonce from chain in case prior tests already used account #0.
  await wallet.getNonce("pending");
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
