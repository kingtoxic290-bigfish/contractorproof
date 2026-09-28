import { Contract, Interface, JsonRpcProvider, NonceManager, Wallet, type TransactionReceipt } from "ethers";
import { env } from "../config/env";
import { RepositoryError } from "../repositories/errors";
import { applicationIdToBytes32, sha256HexToBytes32 } from "./encoding";
import { BLOCKCHAIN_ERROR_CODES, BlockchainError } from "./errors";
import { REGISTRY_ABI } from "./registry.abi";

export type ConfirmedProof = {
  txHash: string;
  blockNumber: number;
  evidenceHash: string;
  eventId: string;
  contractAddress: string;
};

export type RecordProofInput = {
  eventId: string;
  projectId: string;
  milestoneId: string;
  evidenceHash: string;
  actorId: string;
};

type BlockchainConfig = {
  rpcUrl: string;
  contractAddress: string;
  privateKey: string;
  chainId?: number;
  confirmations: number;
  nodeEnv: string;
};

const ZERO = "0x" + "00".repeat(32);

function revertMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return error instanceof Error ? error.message : "blockchain transaction failed";
  }
  const record = error as {
    message?: string;
    shortMessage?: string;
    reason?: string;
    code?: string;
    info?: { error?: { message?: string } };
    data?: { message?: string };
  };
  return [
    record.code,
    record.reason,
    record.shortMessage,
    record.message,
    record.info?.error?.message,
    record.data?.message,
  ]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(" | ");
}

function mapRevert(error: unknown): never {
  const message = revertMessage(error);
  if (/event already recorded/i.test(message)) {
    throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.DUPLICATE_PROOF, "proof event already recorded");
  }
  if (/not authorized/i.test(message)) {
    throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.SIGNER_UNAVAILABLE, "signer is not authorized");
  }
  throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.TRANSACTION_FAILED, "blockchain transaction failed");
}

export class BlockchainService {
  private readonly provider: JsonRpcProvider;
  private readonly config: BlockchainConfig;
  private readonly iface = new Interface(REGISTRY_ABI);
  /** Cached NonceManager so sequential writes on one service stay ordered. */
  private signer: NonceManager | null = null;

  constructor(
    config: Partial<BlockchainConfig> = {},
    provider?: JsonRpcProvider,
  ) {
    this.config = {
      rpcUrl: config.rpcUrl ?? env.rpcUrl,
      contractAddress: config.contractAddress ?? env.contractAddress,
      privateKey: config.privateKey ?? env.blockchainPrivateKey,
      chainId: config.chainId ?? env.chainId,
      confirmations: config.confirmations ?? env.blockchainConfirmations,
      nodeEnv: config.nodeEnv ?? env.nodeEnv,
    };
    // Do not pin a static network: assertReadyForWrites must observe the real chain id.
    this.provider = provider ?? new JsonRpcProvider(this.config.rpcUrl);
  }

  isConfigured(): boolean {
    return Boolean(this.config.contractAddress);
  }

  canWrite(): boolean {
    return this.isConfigured() && Boolean(this.config.privateKey);
  }

  getReadOnlyContract(): Contract {
    this.assertConfigured();
    return new Contract(this.config.contractAddress, REGISTRY_ABI, this.provider);
  }

  getSignerContract(): Contract {
    this.assertConfigured();
    if (!this.config.privateKey) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.SIGNER_UNAVAILABLE,
        "blockchain signer is not configured",
      );
    }
    if (!this.signer) {
      this.signer = new NonceManager(new Wallet(this.config.privateKey, this.provider));
    }
    return new Contract(this.config.contractAddress, REGISTRY_ABI, this.signer);
  }

  async eventExists(eventId: string): Promise<boolean> {
    const contract = this.getReadOnlyContract();
    return Boolean(await contract.eventExists(this.encodeId(eventId, "eventId")));
  }

  async projectIsRegistered(projectId: string): Promise<boolean> {
    const contract = this.getReadOnlyContract();
    return Boolean(await contract.projectExists(this.encodeId(projectId, "projectId")));
  }

  async assertReadyForWrites(): Promise<void> {
    this.assertConfigured();
    if (!this.config.privateKey) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.SIGNER_UNAVAILABLE,
        "blockchain signer is not configured",
      );
    }
    await this.assertNetwork();
    await this.assertContractCode();
  }

  async recordProof(input: RecordProofInput): Promise<ConfirmedProof> {
    return this.recordVerification(input);
  }

  async recordVerification(input: RecordProofInput): Promise<ConfirmedProof> {
    await this.assertReadyForWrites();
    const encoded = this.encodeVerification(input);
    const contract = this.getSignerContract();
    let tx;
    try {
      tx = await contract.recordVerification(
        encoded.eventId,
        encoded.projectId,
        encoded.milestoneId,
        encoded.evidenceHash,
        encoded.actorId,
      );
    } catch (error) {
      mapRevert(error);
    }
    const receipt = await this.waitForConfirmation(tx);
    this.assertVerificationEvent(receipt, encoded);
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      evidenceHash: encoded.evidenceHashHex,
      eventId: input.eventId,
      contractAddress: this.config.contractAddress,
    };
  }

  async registerProject(input: { projectId: string; contractorId: string }): Promise<ConfirmedProof> {
    await this.assertReadyForWrites();
    const contract = this.getSignerContract();
    let tx;
    try {
      tx = await contract.registerProject(
        this.encodeId(input.projectId, "projectId"),
        this.encodeId(input.contractorId, "contractorId"),
      );
    } catch (error) {
      mapRevert(error);
    }
    const receipt = await this.waitForConfirmation(tx);
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      evidenceHash: "",
      eventId: input.projectId,
      contractAddress: this.config.contractAddress,
    };
  }

  async recordAttestation(input: {
    eventId: string;
    projectId: string;
    evidenceHash: string;
    actorId: string;
    approved: boolean;
  }): Promise<ConfirmedProof> {
    await this.assertReadyForWrites();
    const evidenceHash = this.encodeHash(input.evidenceHash);
    const contract = this.getSignerContract();
    let tx;
    try {
      tx = await contract.recordAttestation(
        this.encodeId(input.eventId, "eventId"),
        this.encodeId(input.projectId, "projectId"),
        evidenceHash.bytes32,
        this.encodeId(input.actorId, "actorId"),
        input.approved,
      );
    } catch (error) {
      mapRevert(error);
    }
    const receipt = await this.waitForConfirmation(tx);
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      evidenceHash: evidenceHash.hex,
      eventId: input.eventId,
      contractAddress: this.config.contractAddress,
    };
  }

  async recordDispute(input: {
    eventId: string;
    previousEventId: string;
    actorId: string;
  }): Promise<ConfirmedProof> {
    await this.assertReadyForWrites();
    const encoded = {
      eventId: this.encodeId(input.eventId, "eventId"),
      previousEventId: this.encodeId(input.previousEventId, "previousEventId"),
      actorId: this.encodeId(input.actorId, "actorId"),
    };
    const contract = this.getSignerContract();
    let tx;
    try {
      tx = await contract.recordDispute(
        encoded.eventId,
        encoded.previousEventId,
        encoded.actorId,
      );
    } catch (error) {
      mapRevert(error);
    }
    const receipt = await this.waitForConfirmation(tx);
    this.assertNamedEvent(receipt, "DisputeRecorded", encoded);
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      evidenceHash: "",
      eventId: input.eventId,
      contractAddress: this.config.contractAddress,
    };
  }

  async recordResolution(input: {
    eventId: string;
    disputeEventId: string;
    actorId: string;
  }): Promise<ConfirmedProof> {
    await this.assertReadyForWrites();
    const encoded = {
      eventId: this.encodeId(input.eventId, "eventId"),
      disputeEventId: this.encodeId(input.disputeEventId, "disputeEventId"),
      actorId: this.encodeId(input.actorId, "actorId"),
    };
    const contract = this.getSignerContract();
    let tx;
    try {
      tx = await contract.recordResolution(
        encoded.eventId,
        encoded.disputeEventId,
        encoded.actorId,
      );
    } catch (error) {
      mapRevert(error);
    }
    const receipt = await this.waitForConfirmation(tx);
    this.assertNamedEvent(receipt, "ResolutionRecorded", encoded);
    return {
      txHash: receipt.hash,
      blockNumber: Number(receipt.blockNumber),
      evidenceHash: "",
      eventId: input.eventId,
      contractAddress: this.config.contractAddress,
    };
  }

  private encodeVerification(input: RecordProofInput) {
    const evidenceHash = this.encodeHash(input.evidenceHash);
    return {
      eventId: this.encodeId(input.eventId, "eventId"),
      projectId: this.encodeId(input.projectId, "projectId"),
      milestoneId: this.encodeId(input.milestoneId, "milestoneId"),
      actorId: this.encodeId(input.actorId, "actorId"),
      evidenceHash: evidenceHash.bytes32,
      evidenceHashHex: evidenceHash.hex,
    };
  }

  encodeHash(value: string): { hex: string; bytes32: `0x${string}` } {
    try {
      const bytes32 = sha256HexToBytes32(value);
      if (bytes32 === ZERO) {
        throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.INVALID_HASH, "evidence hash is required");
      }
      return { hex: bytes32.slice(2), bytes32 };
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      if (error instanceof RepositoryError) {
        throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.INVALID_HASH, "evidence hash is invalid");
      }
      throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.INVALID_HASH, "evidence hash is invalid");
    }
  }

  encodeId(id: string, label = "id"): `0x${string}` {
    try {
      const encoded = applicationIdToBytes32(id);
      if (encoded === ZERO) {
        throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.INVALID_ID, `${label} is invalid`);
      }
      return encoded;
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(BLOCKCHAIN_ERROR_CODES.INVALID_ID, `${label} is invalid`);
    }
  }

  private assertConfigured(): void {
    if (!this.config.contractAddress) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.NOT_CONFIGURED,
        "blockchain registry is not configured",
      );
    }
  }

  private async assertNetwork(): Promise<void> {
    try {
      const network = await this.provider.getNetwork();
      if (this.config.chainId && Number(network.chainId) !== this.config.chainId) {
        throw new BlockchainError(
          BLOCKCHAIN_ERROR_CODES.WRONG_NETWORK,
          "blockchain network does not match configuration",
        );
      }
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE,
        "blockchain provider is unavailable",
      );
    }
  }

  private async assertContractCode(): Promise<void> {
    try {
      const code = await this.provider.getCode(this.config.contractAddress);
      if (!code || code === "0x") {
        throw new BlockchainError(
          BLOCKCHAIN_ERROR_CODES.WRONG_CONTRACT,
          "no contract code at the configured address",
        );
      }
    } catch (error) {
      if (error instanceof BlockchainError) {
        throw error;
      }
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE,
        "blockchain provider is unavailable",
      );
    }
  }

  private async waitForConfirmation(tx: { hash: string; wait: (confirms?: number) => Promise<TransactionReceipt | null> }) {
    const receipt = await tx.wait(this.config.confirmations);
    if (!receipt || receipt.status !== 1) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED,
        "blockchain transaction was not confirmed",
      );
    }
    return receipt;
  }

  private assertVerificationEvent(
    receipt: TransactionReceipt,
    encoded: { eventId: string; projectId: string; evidenceHash: string },
  ): void {
    const match = receipt.logs
      .map((log) => {
        try {
          return this.iface.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === "VerificationRecorded");
    if (!match) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH,
        "confirmed transaction did not emit VerificationRecorded",
      );
    }
    if (
      match.args.eventId !== encoded.eventId ||
      match.args.projectId !== encoded.projectId ||
      match.args.evidenceHash !== encoded.evidenceHash
    ) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH,
        "confirmed proof event did not match the submitted identifiers",
      );
    }
  }

  private assertNamedEvent(
    receipt: TransactionReceipt,
    eventName: "DisputeRecorded" | "ResolutionRecorded",
    expected: Record<string, string>,
  ): void {
    const match = receipt.logs
      .map((log) => {
        try {
          return this.iface.parseLog({ topics: [...log.topics], data: log.data });
        } catch {
          return null;
        }
      })
      .find((parsed) => parsed?.name === eventName);
    if (!match) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH,
        `confirmed transaction did not emit ${eventName}`,
      );
    }
    if (Object.entries(expected).some(([name, value]) => match.args[name] !== value)) {
      throw new BlockchainError(
        BLOCKCHAIN_ERROR_CODES.EVENT_MISMATCH,
        `confirmed ${eventName} did not match submitted identifiers`,
      );
    }
  }
}

export const blockchainService = new BlockchainService();
