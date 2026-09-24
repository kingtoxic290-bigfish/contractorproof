import { RepositoryError } from "./errors";

const SHA256_HEX = /^[0-9a-f]{64}$/;

export function normalizeSha256(value: string): string {
  const hex = value.trim().toLowerCase();
  if (!SHA256_HEX.test(hex)) {
    throw new RepositoryError("sha256 must be a 64-character hex SHA-256 digest");
  }
  return hex;
}
