import { ApiError, userFacingError } from "../../services/api/errors";

export type QueryStatus =
  | "idle"
  | "loading"
  | "success"
  | "empty"
  | "unavailable"
  | "error"
  | "forbidden"
  | "unauthorized"
  | "notfound";

export function classifyError(error: unknown): QueryStatus {
  if (error instanceof ApiError) {
    if (error.isNotImplemented) {
      return "unavailable";
    }
    if (error.isForbidden) {
      return "forbidden";
    }
    if (error.isUnauthorized) {
      return "unauthorized";
    }
    if (error.isNotFound) {
      return "notfound";
    }
    if (error.isUnavailable) {
      return "error";
    }
  }
  return "error";
}

export function queryErrorMessage(error: unknown): string {
  return userFacingError(error, "We couldn't load this information. Please try again.");
}

export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const HIDDEN_KEYS = new Set([
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "privateKey",
]);

export function asRecordList(payload: unknown): Record<string, unknown>[] | null {
  if (!Array.isArray(payload)) {
    return null;
  }
  return payload.filter(isPlainRecord);
}

export function asRecord(payload: unknown): Record<string, unknown> | null {
  return isPlainRecord(payload) ? payload : null;
}

export function unwrapNamedList(payload: unknown, key: string): Record<string, unknown>[] | null {
  if (!isPlainRecord(payload)) {
    return null;
  }
  return asRecordList(payload[key]);
}

export function unwrapNamedRecord(payload: unknown, key: string): Record<string, unknown> | null {
  if (!isPlainRecord(payload)) {
    return null;
  }
  return asRecord(payload[key]);
}

export function asDisplayRecord(value: object): Record<string, unknown> {
  return value as Record<string, unknown>;
}

export function asRequiredString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === "string" ? value : null;
}

export function visibleEntries(record: Record<string, unknown>): Array<[string, unknown]> {
  return Object.entries(record).filter(([key]) => !HIDDEN_KEYS.has(key));
}

export function fieldLabel(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

export function scalarText(value: unknown): string | null {
  if (value === null) {
    return "Not provided";
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return null;
}
