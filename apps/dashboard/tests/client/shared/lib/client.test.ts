// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiError } from "../../../../src/client/shared/lib/client";

/**
 * Builds a real, spec-compliant JSON Response for use as a fetch stub's
 * resolved value, rather than a hand-rolled object cast to Response. This
 * lets `res.json()`, `res.ok`, and `res.headers.get(...)` all behave exactly
 * as they do against a real network response.
 */
function jsonResponse(
  status: number,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

/**
 * Stubs the global `fetch` to resolve once with the given Response,
 * regardless of the request passed to it.
 */
function stubFetchOnce(response: Response): void {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => response,
  );
  vi.stubGlobal("fetch", fetchMock);
}

/**
 * Awaits an `apiFetch` call expected to reject with an `ApiError` and
 * returns it, failing the test with a clear message if the call instead
 * resolves or throws something else.
 */
async function captureApiError(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof ApiError) return err;
    throw err;
  }
  throw new Error("expected apiFetch to reject with an ApiError, but it resolved");
}

afterEach(() => {
  // Every test stubs `fetch` globally; restore it so stubs never leak
  // between tests.
  vi.unstubAllGlobals();
});

describe("apiFetch error handling", () => {
  // All calls below omit `options.method`, so apiFetch defaults to GET — a
  // SAFE_METHODS entry. That means getCsrfToken() is never invoked, so the
  // fetch stub never needs to answer a second call to `/auth/csrf`, and the
  // `csrf_token` cookie never needs to be seeded. The logic under test (the
  // `!res.ok` branch) does not depend on the HTTP method.

  it("carries status, message, errorKey, and a numeric retryAfter for a 429 with a Retry-After header", async () => {
    stubFetchOnce(
      jsonResponse(
        429,
        { error: "Too many requests", errorKey: "errors:rateLimited" },
        { "Retry-After": "5" },
      ),
    );

    const error = await captureApiError(apiFetch("/api/whatever"));

    expect(error.status).toBe(429);
    expect(error.message).toBe("Too many requests");
    expect(error.errorKey).toBe("errors:rateLimited");
    expect(error.retryAfter).toBe(5);
  });

  it("yields retryAfter === undefined, not 0, when the Retry-After header is absent", async () => {
    stubFetchOnce(
      jsonResponse(429, { error: "Too many requests", errorKey: "errors:rateLimited" }),
    );

    const error = await captureApiError(apiFetch("/api/whatever"));

    expect(error.status).toBe(429);
    expect(error.retryAfter).toBeUndefined();
  });

  it("yields retryAfter === undefined, not NaN, when Retry-After is an HTTP-date rather than seconds", async () => {
    stubFetchOnce(
      jsonResponse(
        429,
        { error: "Too many requests", errorKey: "errors:rateLimited" },
        // The spec permits an HTTP-date form for Retry-After, not just
        // delay-seconds. Number(<date string>) is NaN, not a parsed value.
        { "Retry-After": "Wed, 21 Oct 2026 07:28:00 GMT" },
      ),
    );

    const error = await captureApiError(apiFetch("/api/whatever"));

    expect(error.retryAfter).toBeUndefined();
  });

  it("throws an ApiError for a non-429 error response without inventing errorKey/retryAfter", async () => {
    stubFetchOnce(jsonResponse(400, { error: "Bad request" }));

    const error = await captureApiError(apiFetch("/api/whatever"));

    expect(error.status).toBe(400);
    expect(error.message).toBe("Bad request");
    expect(error.errorKey).toBeUndefined();
    expect(error.retryAfter).toBeUndefined();
  });

  it("returns the parsed JSON and throws nothing on a successful response", async () => {
    stubFetchOnce(jsonResponse(200, { foo: "bar" }));

    await expect(apiFetch<{ foo: string }>("/api/whatever")).resolves.toEqual({ foo: "bar" });
  });
});
