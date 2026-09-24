import argon2 from "argon2";

const ARGON2_OPTIONS = { type: argon2.argon2id } as const;

/** Dummy Argon2id hash used only to equalize login timing when the email is unknown. */
const UNKNOWN_ACCOUNT_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$seTwV3mQZ0H1ZoXrWi7kJw$Od4WBX+MsrWa2+uaJXfDNE3Ygas3U4ZrJaTzEXI24jk";

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

export async function verifyPasswordOrDummy(
  hash: string | undefined,
  password: string,
): Promise<boolean> {
  return verifyPassword(hash ?? UNKNOWN_ACCOUNT_HASH, password);
}
