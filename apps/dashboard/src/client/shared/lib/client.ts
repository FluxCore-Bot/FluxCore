export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function readCookie(name: string): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${name}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

let csrfInFlight: Promise<string | undefined> | null = null;

/**
 * Obtain a CSRF token for the double-submit check the server enforces on
 * mutating /api requests. Reads the JS-readable `csrf_token` cookie the
 * server sets; if absent, requests one from `/auth/csrf` (which sets the
 * cookie and returns the token). Concurrent callers share one in-flight
 * request so we never race multiple token issuances.
 */
export async function getCsrfToken(): Promise<string | undefined> {
  const existing = readCookie("csrf_token");
  if (existing) return existing;
  if (!csrfInFlight) {
    csrfInFlight = fetch("/auth/csrf", { method: "GET" })
      .then(async (res) => {
        if (!res.ok) return undefined;
        const data = (await res.json().catch(() => null)) as
          | { token?: string }
          | null;
        return data?.token ?? readCookie("csrf_token");
      })
      .catch(() => undefined)
      .finally(() => {
        csrfInFlight = null;
      });
  }
  return csrfInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers["Content-Type"] ??= "application/json";
  }

  // Attach the CSRF double-submit token on mutating requests so the server's
  // requireCsrf preHandler accepts them (cookie value must equal this header).
  const method = (options.method ?? "GET").toUpperCase();
  if (!SAFE_METHODS.has(method)) {
    const csrf = await getCsrfToken();
    if (csrf) headers["x-csrf-token"] ??= csrf;
  }

  const res = await fetch(path, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    window.location.href = "/auth/login";
    throw new ApiError(401, "Not authenticated");
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(
      res.status,
      (data as { error?: string }).error || "Request failed",
    );
  }

  return data as T;
}
