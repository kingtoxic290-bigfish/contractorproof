import { clearSessionToken, readSessionToken } from "../../utils/session";
import { ApiError } from "./errors";

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN ?? "http://localhost:4000";
export const API_BASE_URL = `${API_ORIGIN}/api/v1`;

type UnauthorizedListener = () => void;

let unauthorizedListener: UnauthorizedListener | null = null;

export function onUnauthorized(listener: UnauthorizedListener | null): void {
  unauthorizedListener = listener;
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuthRedirect?: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function errorFromBody(
  body: unknown,
  fallback: string,
): { message: string; resource?: string; code?: string } {
  if (!isRecord(body)) {
    return { message: fallback };
  }

  const resource = typeof body.resource === "string" ? body.resource : undefined;
  const error = body.error;
  if (typeof error === "string" && error.trim()) {
    return { message: error, resource };
  }
  if (isRecord(error)) {
    const message =
      typeof error.message === "string" && error.message.trim() ? error.message : fallback;
    const code = typeof error.code === "string" ? error.code : undefined;
    return { message, resource, code };
  }

  return { message: fallback, resource };
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  const token = readSessionToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const { skipAuthRedirect, body, ...init } = options;

  // Responses are authenticated, per-user and mutable, so the HTTP cache must
  // not be used. Without this the browser revalidates with If-None-Match and
  // Express (ETag on by default) answers 304 Not Modified, which carries no
  // body and therefore cannot satisfy the { data, meta } envelope this client
  // must preserve. Only bodyless requests opt out; mutations are untouched.
  const cache = body === undefined ? "no-store" : init.cache;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
    cache,
    body:
      body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
  });

  // A 304 is a cache revalidation result, not an API error and not a payload.
  // It must never be parsed as an empty envelope.
  if (response.status === 304) {
    throw new ApiError(
      304,
      "The API returned a cached response with no body. Reload to fetch fresh data.",
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !skipAuthRedirect) {
      clearSessionToken();
      unauthorizedListener?.();
    }
    const error = errorFromBody(payload, response.statusText);
    throw new ApiError(response.status, error.message, error.resource, error.code);
  }

  return payload as T;
}

export async function getHealth(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${API_ORIGIN}/health`);
  if (!response.ok) {
    throw new ApiError(response.status, "The API health check did not succeed.");
  }
  return response.json() as Promise<{ status: string; service: string }>;
}
