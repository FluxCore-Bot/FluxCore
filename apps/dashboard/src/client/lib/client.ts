export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = { ...options.headers as Record<string, string> };
  if (options.body) {
    headers["Content-Type"] ??= "application/json";
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
