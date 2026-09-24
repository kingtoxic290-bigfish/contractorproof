import { keccak256, sha256, toUtf8Bytes } from "ethers";
import { describe, expect, it } from "vitest";
import { BlockchainService } from "../../src/blockchain/BlockchainService";
import { applicationIdToBytes32, sha256HexToBytes32 } from "../../src/blockchain/encoding";
import { BLOCKCHAIN_ERROR_CODES } from "../../src/blockchain/errors";
import { normalizeSha256 } from "../../src/repositories/sha256";
import { hashEvidenceBytes } from "../../src/services/evidence/hash";
import { sha256Buffer } from "../../src/utils/hash";

describe("SHA-256 encoding and keccak regression", () => {
  const bytes = Buffer.from("encoding-fixture-bytes");
  const digest = sha256Buffer(bytes);

  it("accepts a 64-character hex SHA-256 as exactly 32 bytes", () => {
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    const encoded = sha256HexToBytes32(digest);
    expect(encoded).toBe(`0x${digest}`);
    expect((encoded.length - 2) / 2).toBe(32);
    expect(Buffer.from(encoded.slice(2), "hex")).toHaveLength(32);
  });

  it("rejects empty, short, long, and non-hex hashes", () => {
    expect(() => normalizeSha256("")).toThrow();
    expect(() => normalizeSha256("deadbeef")).toThrow();
    expect(() => normalizeSha256(`${digest}aa`)).toThrow();
    expect(() => normalizeSha256("g".repeat(64))).toThrow();
    expect(() => sha256HexToBytes32("not-hex")).toThrow();
  });

  it("rejects the zero hash at the blockchain write boundary", () => {
    const service = new BlockchainService({
      contractAddress: "0x0000000000000000000000000000000000000001",
      privateKey: "",
    });
    try {
      service.encodeHash("0".repeat(64));
      expect.unreachable("zero hash must be rejected");
    } catch (error) {
      expect(error).toMatchObject({ code: BLOCKCHAIN_ERROR_CODES.INVALID_HASH });
    }
  });

  it("encodes SHA-256 as raw bytes32 and not keccak256(UTF8(hex))", () => {
    const encoded = sha256HexToBytes32(digest.toUpperCase());
    expect(encoded).toBe(`0x${digest}`);
    expect(encoded).not.toBe(keccak256(toUtf8Bytes(digest)));
    expect(encoded).not.toBe(keccak256(toUtf8Bytes(digest.toUpperCase())));
    expect(encoded).not.toBe(sha256(toUtf8Bytes(digest)));
    expect(hashEvidenceBytes(bytes)).toBe(digest);
  });

  it("encodes application ids as keccak256(utf8(id)) and does not reverse them", () => {
    const uuid = "11111111-1111-4111-8111-111111111111";
    expect(applicationIdToBytes32(uuid)).toBe(keccak256(toUtf8Bytes(uuid)));
    expect(applicationIdToBytes32(uuid)).not.toBe(uuid);
    expect(applicationIdToBytes32(uuid)).not.toContain(uuid);
  });
});
