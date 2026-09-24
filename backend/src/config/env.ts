import dotenv from "dotenv";
import path from "path";
import { assertProductionBlockchainConfig, resolveJwtSecret } from "./secrets";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";

export const env = {
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required(
    "DATABASE_URL",
    "postgresql://contractorproof:contractorproof@localhost:5433/contractorproof",
  ),
  jwtSecret: resolveJwtSecret({
    nodeEnv,
    jwtSecret: process.env.JWT_SECRET,
    allowInsecure: process.env.ALLOW_INSECURE_JWT_SECRET === "true",
  }),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:5173",
  storagePath: process.env.STORAGE_PATH ?? path.resolve(__dirname, "../../storage"),
  rpcUrl: process.env.RPC_URL ?? "http://127.0.0.1:8545",
  blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY ?? "",
  contractAddress: process.env.CONTRACT_ADDRESS ?? "",
  chainId: process.env.CHAIN_ID ? Number(process.env.CHAIN_ID) : undefined,
  blockchainConfirmations: Number(process.env.BLOCKCHAIN_CONFIRMATIONS ?? 1),
  nodeEnv,
};

assertProductionBlockchainConfig({
  nodeEnv: env.nodeEnv,
  contractAddress: env.contractAddress,
  privateKey: env.blockchainPrivateKey,
});
