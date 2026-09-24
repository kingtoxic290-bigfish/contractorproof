import { keccak256, sha256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import { BlockchainService } from "../src/blockchain/BlockchainService";
import { applicationIdToBytes32, sha256HexToBytes32 } from "../src/blockchain/encoding";
import { BLOCKCHAIN_ERROR_CODES, BlockchainError } from "../src/blockchain/errors";
import { sha256Buffer } from "../src/utils/hash";

const HASH_A = sha256Buffer(Buffer.from("canonical-file-bytes"));

describe("blockchain encoding and service guards", () => {
  it("encodes SHA-256 as raw bytes32 and does not keccak the hex string", () => {
    const encoded = sha256HexToBytes32(HASH_A.toUpperCase());
    expect(encoded).toBe(`0x${HASH_A}`);
    expect(encoded).not.toBe(keccak256(toUtf8Bytes(HASH_A)));
    expect(encoded).not.toBe(sha256(toUtf8Bytes(HASH_A)));
  });

  it("encodes application ids as keccak256(utf8(id)) deterministically", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    expect(applicationIdToBytes32(uuid)).toBe(keccak256(toUtf8Bytes(uuid)));
    expect(applicationIdToBytes32(uuid)).toBe(applicationIdToBytes32(` ${uuid} `));
  });

  it("rejects malformed hashes before a transaction is attempted", () => {
    const service = new BlockchainService({ contractAddress: "", privateKey: "" });
    expect(() => service.encodeHash("not-a-hash")).toThrow(BlockchainError);
    try {
      service.encodeHash("deadbeef");
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.INVALID_HASH });
    }
  });

  it("reports unconfigured writes without leaking a private key", () => {
    const service = new BlockchainService({
      contractAddress: "",
      privateKey: "0xshould-never-appear-in-errors",
    });
    expect(service.isConfigured()).toBe(false);
    try {
      service.getSignerContract();
    } catch (error) {
      expect(error).toBeInstanceOf(BlockchainError);
      expect(JSON.stringify(error)).not.toContain("0xshould-never-appear-in-errors");
    }
  });

  it("requires a signer when the contract address is set", () => {
    const service = new BlockchainService({
      contractAddress: "0x0000000000000000000000000000000000000001",
      privateKey: "",
    });
    expect(service.isConfigured()).toBe(true);
    expect(service.canWrite()).toBe(false);
    try {
      service.getSignerContract();
      expect.unreachable("signer should be unavailable");
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.SIGNER_UNAVAILABLE });
    }
  });

  it("detects a wrong network and an empty contract address", async () => {
    const provider = {
      getNetwork: async () => ({ chainId: 1n }),
      getCode: async () => "0x",
    } as never;
    const service = new BlockchainService(
      {
        contractAddress: "0x0000000000000000000000000000000000000001",
        privateKey: `0x${"11".repeat(32)}`,
        chainId: 31337,
      },
      provider,
    );
    await expect(service.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.WRONG_NETWORK,
    });

    const wrongContract = new BlockchainService(
      {
        contractAddress: "0x0000000000000000000000000000000000000001",
        privateKey: `0x${"11".repeat(32)}`,
        chainId: 1,
      },
      provider,
    );
    await expect(wrongContract.assertReadyForWrites()).rejects.toMatchObject({
      code: BLOCKCHAIN_ERROR_CODES.WRONG_CONTRACT,
    });
  });
});
