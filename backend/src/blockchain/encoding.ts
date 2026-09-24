import { keccak256, toUtf8Bytes } from "ethers";
import { normalizeSha256 } from "../repositories/sha256";

/**
 * Canonical encodings (ADR-0002 / blockchain-model.md):
 *
 * evidenceHash:
 *   64 lowercase hex SHA-256 of file bytes → 32 raw bytes (bytes32).
 *   Do not keccak the hex string.
 *
 * application ids (projectId, eventId, actorId, milestoneId, contractorId, variationRef):
 *   keccak256(utf8(stable-id))
 *   Deterministic and collision-resistant for UUID space.
 *   Not reversible; PostgreSQL remains the source of the original UUID.
 */
export function sha256HexToBytes32(value: string): `0x${string}` {
  const hex = normalizeSha256(value);
  return `0x${hex}`;
}

export function applicationIdToBytes32(id: string): `0x${string}` {
  const normalized = id.trim();
  if (!normalized) {
    throw new Error("application id is required");
  }
  return keccak256(toUtf8Bytes(normalized)) as `0x${string}`;
}

export function encodeEvidenceHash(value: string): `0x${string}` {
  return sha256HexToBytes32(value);
}

export function encodeApplicationId(id: string): `0x${string}` {
  return applicationIdToBytes32(id);
}
