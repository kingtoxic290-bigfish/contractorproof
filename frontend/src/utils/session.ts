const TOKEN_KEY = "contractorproof_token";

export function readSessionToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function writeSessionToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearSessionToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}

export function hasSessionToken(): boolean {
  return Boolean(readSessionToken());
}
