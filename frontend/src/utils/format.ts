/**
 * Presentation-only formatting helpers.
 *
 * These format values the backend already returned. They never derive, infer or
 * create new business data.
 */

const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function toDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a backend timestamp for display, e.g. "04 Sep 2026, 14:30".
 * Returns null when the value is missing so callers can state that explicitly.
 */
export function formatDateTime(value: string | null | undefined): string | null {
  const date = toDate(value);
  return date ? DATE_TIME_FORMAT.format(date) : null;
}

/** Formats a backend date for display, e.g. "04 Sep 2026". */
export function formatDate(value: string | null | undefined): string | null {
  const date = toDate(value);
  return date ? DATE_FORMAT.format(date) : null;
}

/**
 * Renders a backend timestamp as a `<time>` element with a machine-readable
 * `dateTime` attribute, or a factual placeholder when no timestamp was returned.
 */
export function formatTimestamp(value: string | null | undefined): { dateTime: string; text: string } | null {
  const date = toDate(value);
  if (!date || !value) {
    return null;
  }
  return { dateTime: value, text: DATE_TIME_FORMAT.format(date) };
}

/**
 * Shortens a long identifier for compact display (e.g. breadcrumbs).
 * The full value is always still available to assistive technology and sighted
 * users via the adjacent title attribute supplied by the caller.
 */
export function shortIdentifier(value: string | undefined, visible = 8): string {
  if (!value) {
    return "";
  }
  return value.length <= visible + 6 ? value : `${value.slice(0, visible)}…`;
}
