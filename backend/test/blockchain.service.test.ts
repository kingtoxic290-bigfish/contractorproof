import { randomUUID } from "crypto";
import { describe, expect, it } from "vitest";
import { BlockchainService } from "../src/blockchain/BlockchainService";
import { BLOCKCHAIN_ERROR_CODES } from "../src/blockchain/errors";
import { sha256Buffer } from "../src/utils/hash";

const HASH_A = sha256Buffer(Buffer.from("blockchain-service-bytes"));

describe("BlockchainService failure handling (no live RPC required)", () => {
  it("rejects missing receipt and reverted-status receipts without fabricating confirmation", async () => {
    const chain = new BlockchainService({
      contractAddress: "0x00000000000000000000000000000000000000cd",
      privateKey: `0x${"33".repeat(32)}`,
    });
    const wait = (
      chain as unknown as {
        waitForConfirmation: (tx: {
          hash: string;
          wait: (n?: number) => Promise<{ hash: string; status: number; blockNumber: bigint; logs: unknown[] } | null>;
        }) => Promise<unknown>;
      }
    ).waitForConfirmation.bind(chain);

    await expect(
      wait({
        hash: "0xmissing",
        wait: async () => null,
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED });

    await expect(
      wait({
        hash: "0xreverted",
        wait: async () => ({ hash: "0xreverted", status: 0, blockNumber: 9n, logs: [] }),
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.CONFIRMATION_FAILED });
  });

  it("rejects unconfigured and RPC-down writes without claiming success", async () => {
    const unconfigured = new BlockchainService({
      contractAddress: "",
      privateKey: "0xshould-never-leak",
    });
    await expect(
      unconfigured.registerProject({
        projectId: randomUUID(),
        contractorId: randomUUID(),
      }),
    ).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.NOT_CONFIGURED });

    const rpcDown = new BlockchainService(
      {
        contractAddress: "0x0000000000000000000000000000000000000001",
        privateKey: `0x${"11".repeat(32)}`,
        chainId: 31337,
      },
      {
        getNetwork: async () => {
          throw new Error("ECONNREFUSED 127.0.0.1:8545");
        },
        getCode: async () => {
          throw new Error("ECONNREFUSED 127.0.0.1:8545");
        },
      } as never,
    );
    await expect(rpcDown.recordVerification({
      eventId: randomUUID(),
      projectId: randomUUID(),
      milestoneId: randomUUID(),
      evidenceHash: HASH_A,
      actorId: randomUUID(),
    })).rejects.toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.PROVIDER_FAILURE });
  });
});
