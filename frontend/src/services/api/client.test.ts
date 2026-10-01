import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest } from "./client";
import { ApiError } from "./errors";
import { writeSessionToken } from "../../utils/session";

function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
  const { status = 200, statusText = "OK" } = init;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: async () => body,
  } as unknown as Response;
}

/** A 304 carries no body, exactly as it arrives from a cache revalidation. */
function notModifiedResponse() {
  return {
    ok: false,
    status: 304,
    statusText: "",
    json: async () => {
      throw new SyntaxError("Unexpected end of JSON input");
    },
  } as unknown as Response;
}

describe("apiRequest cache handling", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    writeSessionToken("jwt-token");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opts bodyless requests out of the HTTP cache so no bodyless 304 is returned", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ contractors: [] }));

    await apiRequest<{ contractors: unknown[] }>("/contractors");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBe("no-store");
  });

  it("still preserves the Authorization header and the data/meta envelope", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ contractors: [{ id: "c1" }] }, { status: 200 }),
    );

    const payload = await apiRequest<{ data: { contractors: unknown[] } }>("/contractors");

    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.get("Authorization")).toBe("Bearer jwt-token");
    expect(payload).toEqual({ contractors: [{ id: "c1" }] });
  });

  it("does not treat a 304 as a successful empty payload", async () => {
    fetchMock.mockResolvedValue(notModifiedResponse());

    // Before the fix this threw an ApiError with an empty message, which the
    // UI rendered as the generic "We couldn't load this information", hiding
    // the real cause behind a cache revalidation.
    await expect(apiRequest("/contractors")).rejects.toBeInstanceOf(ApiError);
    await expect(apiRequest("/contractors")).rejects.toMatchObject({ status: 304 });
    await expect(apiRequest("/contractors")).rejects.toThrow(/cached response with no body/);
  });

  it("surfaces a non-generic message for a 304 instead of a blank error", async () => {
    fetchMock.mockResolvedValue(notModifiedResponse());

    // userFacingError falls back to a generic string for an empty message,
    // which is what the contractor selector was displaying.
    const cause = await apiRequest("/contractors").catch((error: unknown) => error);
    expect(cause).toBeInstanceOf(ApiError);
    expect((cause as ApiError).message).not.toBe("");
  });

  it("leaves requests that carry a body untouched", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { id: "p1" } }, { status: 201 }));

    await apiRequest("/projects", { method: "POST", body: { name: "Demo" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.cache).toBeUndefined();
    expect(init.method).toBe("POST");
  });
});